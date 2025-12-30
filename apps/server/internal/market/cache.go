package market

import (
	"context"
	"fmt"
	"log"
	"time"
)

func (s *Service) GetFromCache(ctx context.Context, symbol, exchange string, start, granularity int64) []Candlestick {
	s.cacheMx.RLock()
	cacheKey := fmt.Sprintf("%s-%s-%d-%d", symbol, exchange, granularity, start)
	candles, exists := s.cache[cacheKey]
	s.cacheMx.RUnlock()

	if exists {
		log.Printf("Cache hit: %s\n", cacheKey)
		return candles.Data
	}
	return []Candlestick{}
}

func (s *Service) SaveToCache(ctx context.Context, symbol, exchange string, start, granularity int64, candles []Candlestick) {
	s.cacheMx.Lock()
	cacheKey := fmt.Sprintf("%s-%s-%d-%d", symbol, exchange, granularity, start)
	log.Printf("Cache miss: %s\n", cacheKey)
	s.cache[cacheKey] = CacheCandleBatch{candles, time.Now()}
	s.cacheMx.Unlock()
}

func (s *Service) StartCachePruner(ctx context.Context, ttl time.Duration) {
	log.Println("Starting cache pruner")
	ticker := time.NewTicker(ttl)
	defer ticker.Stop()

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.PruneCache(ttl)
			}
		}

	}()
}

func (s *Service) PruneCache(ttl time.Duration) {
	s.cacheMx.Lock()
	defer s.cacheMx.Unlock()

	log.Println("Pruning cache")
	now := time.Now()
	for k, v := range s.cache {
		if now.Sub(v.CreatedAt) > ttl {
			delete(s.cache, k)
		}
	}
}
