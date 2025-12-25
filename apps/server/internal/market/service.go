package market

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"sort"
	"sync"
	"time"

	"github.com/0men1/cochart/internal/market/exchange"
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

var maxConcurrentRquests = 10

func (s *Service) FetchCandles(ctx context.Context, symbol, provider string, start, end, granularity int64) ([][]float64, error) {
	candlesNeeded := (end - start) / granularity

	exchange, err := exchange.GetExchangeInfo(provider, "crypto")
	if err != nil {
		return nil, err
		// TODO: handle error
	}

	batchCount := int((candlesNeeded + maxCandlesPerRequest - 1) / maxCandlesPerRequest)
	responseChan := make(chan candleResponse, batchCount)

	sem := make(chan struct{}, maxConcurrentRquests)

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	var wg sync.WaitGroup
	wg.Add(batchCount)

	for i := range batchCount {
		go func(index int) {
			defer wg.Done()

			sem <- struct{}{}
			defer func() { <-sem }()

			batchStart := start + int64(index)*granularity*maxCandlesPerRequest
			batchEnd := min(batchStart+(granularity*maxCandlesPerRequest), end)

			var candles []Candlestick
			var err error

			for attempt := range 3 {
				candles, err = s.fetchFromExchange(ctx, symbol, exchange.URL, batchStart, batchEnd, granularity)

				if err == nil {
					break
				}

				backoff := time.Duration(200*(1<<attempt)) * time.Millisecond
				jitter := time.Duration(rand.Intn(50)) * time.Millisecond

				select {
				case <-ctx.Done():
					responseChan <- candleResponse{Index: index, Error: ctx.Err()}
					return
				case <-time.After(backoff + jitter):
					// Retry
					continue
				}
			}
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

func (s *Service) fetchFromExchange(ctx context.Context, symbol, rawURL string, start, end, granularity int64) ([]Candlestick, error) {
	url := fmt.Sprintf(rawURL, symbol, granularity, start, end)

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
