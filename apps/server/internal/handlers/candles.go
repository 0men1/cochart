package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
)

func getInterval(timeframe string) (int64, error) {
	intervals := map[string]int64{
		"1m":  60,
		"5m":  300,
		"15m": 900,
		"1H":  3600,
		"6H":  21600,
		"1D":  86400,
	}

	if interval, ok := intervals[timeframe]; ok {
		return interval, nil
	}
	return 0, fmt.Errorf("unsupported interval")
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

func (h *MarketHandler) GetCandles(w http.ResponseWriter, r *http.Request) {
	symbol := r.URL.Query().Get("symbol")
	timeframe := r.URL.Query().Get("timeframe")
	provider := r.URL.Query().Get("provider")

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

	candles, err := h.Service.FetchCandles(r.Context(), provider, symbol, start, end, granularity)
	if err != nil {
		log.Printf("Fetch error: %v", err)
		http.Error(w, "Failed to fetch candles", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(candles)
}
