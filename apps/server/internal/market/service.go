package market

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"sync"
	"time"
)

type Service struct {
	client *http.Client
}

type candleResponse struct {
	Data  []Candlestick
	Index int
	Error error
}

var candlePool = sync.Pool{
	New: func() interface{} {
		return make([]Candlestick, 0, 300)
	},
}

const maxCandlesPerRequest = 300

func NewService() *Service {
	return &Service{
		client: &http.Client{
			Timeout: 10 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 10,
				IdleConnTimeout:     90 * time.Second,
			},
		},
	}
}

func (s *Service) FetchCandles(ctx context.Context, symbol string, start, end, granularity int64) ([][]float64, error) {
	candlesNeeded := (end - start) / granularity

	if candlesNeeded <= maxCandlesPerRequest {
		return s.fetchSingleBatch(ctx, symbol, start, end, granularity)
	}

	return s.fetchMultipleBatches(ctx, symbol, start, end, granularity, candlesNeeded)
}

func (s *Service) fetchSingleBatch(ctx context.Context, symbol string, start, end, granularity int64) ([][]float64, error) {
	candles, err := s.fetchFromCoinbase(ctx, symbol, start, end, granularity)
	if err != nil {
		return nil, err
	}
	return convertToResponse(candles), nil
}

func (s *Service) fetchMultipleBatches(ctx context.Context, symbol string, start, end, granularity, candlesNeeded int64) ([][]float64, error) {
	batchCount := int((candlesNeeded + maxCandlesPerRequest - 1) / maxCandlesPerRequest)
	responseChan := make(chan candleResponse, batchCount)

	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	var wg sync.WaitGroup
	wg.Add(batchCount)

	for i := 0; i < batchCount; i++ {
		go func(index int) {
			defer wg.Done()

			// Calculate time window for this specific batch
			batchStart := start + int64(index)*granularity*maxCandlesPerRequest
			batchEnd := min(batchStart+(granularity*maxCandlesPerRequest), end)

			candles, err := s.fetchFromCoinbase(ctx, symbol, batchStart, batchEnd, granularity)
			responseChan <- candleResponse{Data: candles, Index: index, Error: err}
		}(i)
	}

	go func() {
		wg.Wait()
		close(responseChan)
	}()

	return s.collectResponses(responseChan, batchCount)
}

func (s *Service) collectResponses(responseChan <-chan candleResponse, expected int) ([][]float64, error) {
	responses := make([]candleResponse, expected)

	for res := range responseChan {
		if res.Error != nil {
			return nil, res.Error
		}
		// Guard against index out of bounds if API behaves unexpectedly
		if res.Index >= 0 && res.Index < expected {
			responses[res.Index] = res
		}
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

func (s *Service) fetchFromCoinbase(ctx context.Context, symbol string, start, end, granularity int64) ([]Candlestick, error) {
	url := fmt.Sprintf("https://api.exchange.coinbase.com/products/%s/candles?granularity=%d&start=%d&end=%d",
		symbol, granularity, start, end)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	res, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("coinbase api error: %d", res.StatusCode)
	}

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

func min(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}
