package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sort"
	"strconv"
	"sync"
	"time"
)

type Candlestick struct {
	Timestamp int64
	Low       float64
	High      float64
	Open      float64
	Close     float64
	Volume    float64
}

type CandleResponse struct {
	Data  []Candlestick
	Index int
	Error error
}

type CandleRequest struct {
	Symbol      string
	Start       int64
	End         int64
	Granularity int64
	Index       int
}

var (
	httpClient = &http.Client{
		Timeout: 5 * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:        100,
			MaxIdleConnsPerHost: 10,
			IdleConnTimeout:     90 * time.Second,
		},
	}
	candlePool = sync.Pool{
		New: func() interface{} {
			return make([]Candlestick, 0, 300)
		},
	}
)

const maxCandlesPerRequest = 300

func GetCandles(w http.ResponseWriter, r *http.Request) {
	symbol := r.URL.Query().Get("symbol")
	timeframe := r.URL.Query().Get("timeframe")

	if symbol == "" || timeframe == "" {
		http.Error(w, "Must include symbol/timeframe", http.StatusBadRequest)
		return
	}

	granularity, err := getInterval(timeframe)
	if err != nil {
		http.Error(w, "Unsupported timeframe", http.StatusBadRequest)
		return
	}

	start, end, err := parseTimeRange(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	candles, err := fetchCandles(r.Context(), symbol, start, end, granularity)
	if err != nil {
		log.Printf("Fetch error: %v", err)
		http.Error(w, "Failed to fetch candles", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(candles)
}

func parseTimeRange(r *http.Request) (int64, int64, error) {
	var start, end int64
	var err error

	if startParam := r.URL.Query().Get("start"); startParam != "" {
		if start, err = strconv.ParseInt(startParam, 10, 64); err != nil {
			return 0, 0, fmt.Errorf("invalid start")
		}
	}

	if endParam := r.URL.Query().Get("end"); endParam != "" {
		if end, err = strconv.ParseInt(endParam, 10, 64); err != nil {
			return 0, 0, fmt.Errorf("invalid end")
		}
	}

	return start, end, nil
}

func fetchCandles(ctx context.Context, symbol string, start, end, granularity int64) ([][]float64, error) {
	candlesNeeded := (end - start) / granularity

	if candlesNeeded <= maxCandlesPerRequest {
		return fetchSingleBatch(ctx, symbol, start, end, granularity)
	}

	return fetchMultipleBatches(ctx, symbol, start, end, granularity, candlesNeeded)
}

func fetchSingleBatch(ctx context.Context, symbol string, start, end, granularity int64) ([][]float64, error) {
	candles, err := fetchFromCoinbase(ctx, symbol, start, end, granularity)
	if err != nil {
		return nil, err
	}
	return convertToResponse(candles), nil
}

func fetchMultipleBatches(ctx context.Context, symbol string, start, end, granularity, candlesNeeded int64) ([][]float64, error) {
	batchCount := int((candlesNeeded + maxCandlesPerRequest - 1) / maxCandlesPerRequest)

	responseChan := make(chan CandleResponse, batchCount)
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var wg sync.WaitGroup
	wg.Add(batchCount)

	for i := 0; i < batchCount; i++ {
		go func(index int) {
			defer wg.Done()

			batchStart := start + int64(index)*granularity*maxCandlesPerRequest
			batchEnd := min(batchStart+granularity*maxCandlesPerRequest, end)

			candles, err := fetchFromCoinbase(ctx, symbol, batchStart, batchEnd, granularity)
			responseChan <- CandleResponse{Data: candles, Index: index, Error: err}
		}(i)
	}

	go func() {
		wg.Wait()
		close(responseChan)
	}()

	return collectResponses(responseChan, batchCount)
}

func collectResponses(responseChan <-chan CandleResponse, expected int) ([][]float64, error) {
	responses := make([]CandleResponse, expected)

	for res := range responseChan {
		if res.Error != nil {
			return nil, res.Error
		}
		responses[res.Index] = res
	}

	totalSize := 0
	for _, r := range responses {
		totalSize += len(r.Data)
	}

	result := make([]Candlestick, 0, totalSize)
	for _, r := range responses {
		result = append(result, r.Data...)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].Timestamp < result[j].Timestamp
	})

	return convertToResponse(result), nil
}

func fetchFromCoinbase(ctx context.Context, symbol string, start, end, granularity int64) ([]Candlestick, error) {
	url := fmt.Sprintf("https://api.exchange.coinbase.com/products/%s/candles?granularity=%d&start=%d&end=%d",
		symbol, granularity, start, end)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	res, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}

	var raw [][]float64
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("parse error: %v", err)
	}

	candles := candlePool.Get().([]Candlestick)[:0]

	for _, c := range raw {
		if len(c) >= 6 {
			candles = append(candles, Candlestick{
				Timestamp: int64(c[0]),
				Low:       c[1],
				High:      c[2],
				Open:      c[3],
				Close:     c[4],
				Volume:    c[5],
			})
		}
	}

	sort.Slice(candles, func(i, j int) bool {
		return candles[i].Timestamp < candles[j].Timestamp
	})

	return candles, nil
}

func convertToResponse(candles []Candlestick) [][]float64 {
	result := make([][]float64, len(candles))
	for i, c := range candles {
		result[i] = []float64{
			float64(c.Timestamp),
			c.Low,
			c.High,
			c.Open,
			c.Close,
			c.Volume,
		}
	}
	return result
}

func getInterval(timeframe string) (int64, error) {
	intervals := map[string]int64{
		"1m":  60,
		"5m":  300,
		"15m": 900,
		"1h":  3600,
		"1d":  86400,
	}

	if interval, ok := intervals[timeframe]; ok {
		return interval, nil
	}
	return 0, fmt.Errorf("unsupported interval")
}
