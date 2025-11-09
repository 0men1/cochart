package main

import (
	"log"
	"net/http"
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
	http.Handle("/rooms/create", WithCORS(http.HandlerFunc(CreateRoom)))
	http.Handle("/rooms/join", WithCORS(http.HandlerFunc(JoinRoom)))
	http.Handle("/candles", WithCORS(http.HandlerFunc(GetCandles)))
	log.Println("Server listening on port 8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
