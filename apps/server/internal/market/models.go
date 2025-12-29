package market

import (
	"context"
	"sync"
)

type Candlestick struct {
	Timestamp int64   `json:"time"`
	Open      float64 `json:"open"`
	High      float64 `json:"high"`
	Low       float64 `json:"low"`
	Close     float64 `json:"close"`
	Volume    float64 `json:"volume,omitempty"`
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

type ExchangeProvider interface {
	ID() string
	FetchCandles(ctx context.Context, symbol string, start, end, granularity int64) ([]Candlestick, error)
	GetProducts() ([]Product, error)
}

type Product struct {
	ID       string
	Name     string
	Type     string
	Exchange string
}

type Service struct {
	Providers map[string]ExchangeProvider

	cacheMx sync.RWMutex
	// Cache ID: <symbol>-<exchange>-<granularity>-<startTime>
	cache map[string][]Candlestick
}

func NewService(providers map[string]ExchangeProvider) *Service {
	cache := make(map[string][]Candlestick)
	return &Service{Providers: providers, cache: cache}
}
