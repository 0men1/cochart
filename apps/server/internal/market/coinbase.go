package market

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
)

type CoinbaseProvider struct {
	Client  *http.Client
	BaseURL string
}

func (c *CoinbaseProvider) ID() string {
	return "coinbase"
}

func (c *CoinbaseProvider) FetchCandlesFromExchange(ctx context.Context, symbol string, start, end, granularity int64) ([]Candlestick, error) {
	// API Docs: /products/{product_id}/candles
	url := fmt.Sprintf("%s/products/%s/candles?granularity=%d&start=%d&end=%d",
		c.BaseURL, symbol, granularity, start, end)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("User-Agent", "Cochart-App")

	res, err := c.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(res.Body)
		return nil, fmt.Errorf("coinbase error %d: %s", res.StatusCode, string(body))
	}

	// Parse Response (Coinbase returns array of arrays)
	// [ [ time, low, high, open, close, volume ], ... ]
	var raw [][]float64
	if err := json.NewDecoder(res.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("parse error: %v", err)
	}

	candles := make([]Candlestick, 0, len(raw))

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

	// Coinbase returns newest first we usually want oldest first
	sort.Slice(candles, func(i, j int) bool {
		return candles[i].Timestamp < candles[j].Timestamp
	})

	return candles, nil
}
