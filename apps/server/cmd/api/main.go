package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/0men1/cochart/internal/handlers"
	"github.com/0men1/cochart/internal/market"
	"github.com/0men1/cochart/internal/rooms"
)

func WithCORS(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Origin, Upgrade, Connection, Sec-WebSocket-Key, Sec-WebSocket-Version")

		if r.Method == "OPTIONS" {
			return
		}

		h.ServeHTTP(w, r)
	})
}

func main() {
	// UpdateEnvVars(".env")

	httpClient := http.Client{
		Timeout: 10 * time.Second,
	}

	// Setup Providers
	providers := map[string]market.ExchangeProvider{
		"coinbase": &market.CoinbaseProvider{
			Client:  &httpClient,
			BaseURL: "https://api.exchange.coinbase.com",
		},
	}

	// Setup Services
	marketService := market.NewService(providers)
	roomManager := rooms.NewManager()

	// Setup Handlers
	wsHandler := handlers.NewWSHandler(roomManager)
	marketHandler := handlers.NewMarketHandler(marketService)

	// Routes
	http.Handle("/rooms/create", WithCORS(http.HandlerFunc(wsHandler.CreateRoom)))
	http.Handle("/rooms/join", WithCORS(http.HandlerFunc(wsHandler.JoinRoom)))
	http.Handle("/candles", WithCORS(http.HandlerFunc(marketHandler.GetCandles)))

	env := os.Getenv("APP_ENV")

	if env == "production" {
		certFile := "/etc/letsencrypt/live/api.cochart.app/fullchain.pem"
		keyFile := "/etc/letsencrypt/live/api.cochart.app/privkey.pem"
		log.Println("Starting HTTPS server on :443")
		log.Fatal(http.ListenAndServeTLS(":443", certFile, keyFile, nil))
	} else {
		log.Println("Starting HTTP server on :8080")
		log.Fatal(http.ListenAndServe(":8080", nil))
	}
}
