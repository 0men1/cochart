package market

import (
	"context"
	"fmt"
	"math/rand"
	"sort"
	"sync"
	"time"
)

const maxCandlesPerRequest = 300
const maxConcurrentRequests = 10

func (s *Service) FetchCandles(ctx context.Context, exchangeName, symbol string, start, end, granularity int64) ([]Candlestick, error) {
	provider, exists := s.Providers[exchangeName]
	if !exists {
		return nil, fmt.Errorf("exchange %s not found", exchangeName)
	}

	// Snap requset to grid
	blockDuration := granularity * int64(maxCandlesPerRequest)
	alignedStart := (start / blockDuration) * blockDuration

	var batchStarts []int64
	for t := alignedStart; t < end; t += blockDuration {
		batchStarts = append(batchStarts, t)
	}

	responseChan := make(chan CandleResponse, len(batchStarts))
	sem := make(chan struct{}, maxConcurrentRequests)

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	var wg sync.WaitGroup

	for i, batchStart := range batchStarts {
		wg.Add(1)
		go func(idx int, bStart int64) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			bEnd := bStart + blockDuration
			cachedCandles := s.GetFromCache(ctx, symbol, exchangeName, bStart, granularity)
			if len(cachedCandles) > 0 {
				responseChan <- CandleResponse{Data: cachedCandles, Index: idx, Error: nil}
				return
			}

			var candles []Candlestick
			var err error

			// Retry Logic
			for attempt := range 3 {
				candles, err = provider.FetchCandles(ctx, symbol, batchStart, bEnd, granularity)
				if err == nil {
					break
				}

				// Exponential backoff
				backoff := time.Duration(200*(1<<attempt)) * time.Millisecond
				jitter := time.Duration(rand.Intn(50)) * time.Millisecond

				select {
				case <-ctx.Done():
					responseChan <- CandleResponse{Index: idx, Error: ctx.Err()}
					return
				case <-time.After(backoff + jitter):
					continue
				}
			}

			s.SaveToCache(ctx, symbol, exchangeName, bStart, granularity, candles)
			responseChan <- CandleResponse{Data: candles, Index: idx, Error: err}
		}(i, batchStart)
	}

	go func() {
		wg.Wait()
		close(responseChan)
	}()

	fullData, err := collectResponses(responseChan, len(batchStarts))
	if err != nil {
		return []Candlestick{}, err
	}

	return fullData, nil
}

func collectResponses(responseChan <-chan CandleResponse, expected int) ([]Candlestick, error) {
	responses := make([]CandleResponse, expected)
	// Default initialize to avoid nil panic on sort
	for i := range responses {
		responses[i].Data = []Candlestick{}
	}

	for res := range responseChan {
		if res.Error != nil {
			return nil, res.Error
		}
		if res.Index >= 0 && res.Index < expected {
			responses[res.Index] = res
		}
	}

	// Merge
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

	return result, nil
}
