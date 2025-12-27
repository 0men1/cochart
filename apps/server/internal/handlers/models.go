package handlers

import "github.com/0men1/cochart/internal/market"

type MarketHandler struct {
	Service      *market.Service
	SearchEngine *market.Engine
}

func NewMarketHandler(service *market.Service) *MarketHandler {
	return &MarketHandler{Service: service, SearchEngine: market.NewEngine(service.Providers)}
}
