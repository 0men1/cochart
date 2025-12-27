package market

import (
	"context"
	"fmt"
	"math/rand"
	"sort"
	"sync"
	"time"
)

func (s *Service) FetchCandles(ctx context.Context, exchangeName, symbol string, start, end, granularity int64) ([]Candlestick, error) {
	provider, exists := s.Providers[exchangeName]
	if !exists {
		return nil, fmt.Errorf("exchange %s not found", exchangeName)
	}

	const maxCandlesPerRequest = 300
	const maxConcurrentRequests = 10

	candlesNeeded := (end - start) / granularity
	if candlesNeeded <= 0 {
		return []Candlestick{}, nil
	}

	batchCount := int((candlesNeeded + maxCandlesPerRequest - 1) / maxCandlesPerRequest)
	responseChan := make(chan CandleResponse, batchCount)
	sem := make(chan struct{}, maxConcurrentRequests)

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	var wg sync.WaitGroup
	wg.Add(batchCount)

	for i := range batchCount {
		go func(index int) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			// Calculate time windows for this batch
			batchStart := start + int64(index)*maxCandlesPerRequest*granularity
			// Ensure we don't request past the end time
			batchEnd := batchStart + (maxCandlesPerRequest * granularity)
			if batchEnd > end {
				batchEnd = end
			}

			var candles []Candlestick
			var err error

			// Retry Logic
			for attempt := range 3 {
				candles, err = provider.FetchCandles(ctx, symbol, batchStart, batchEnd, granularity)
				if err == nil {
					break
				}

				// Exponential backoff
				backoff := time.Duration(200*(1<<attempt)) * time.Millisecond
				jitter := time.Duration(rand.Intn(50)) * time.Millisecond

				select {
				case <-ctx.Done():
					responseChan <- CandleResponse{Index: index, Error: ctx.Err()}
					return
				case <-time.After(backoff + jitter):
					continue
				}
			}
			responseChan <- CandleResponse{Data: candles, Index: index, Error: err}
		}(i)
	}

	go func() {
		wg.Wait()
		close(responseChan)
	}()

	return collectResponses(responseChan, batchCount)
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
