package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
)

func (h *MarketHandler) Search(w http.ResponseWriter, r *http.Request) {
	userInput := r.URL.Query().Get("q")
	limit, err := strconv.Atoi(r.URL.Query().Get("l"))

	if err != nil {
		http.Error(w, "Invalid limit", http.StatusBadRequest)
		return
	}

	if userInput == "" {
		http.Error(w, "Must include query", http.StatusBadRequest)
		return
	}

	products := h.SearchEngine.Search(userInput, limit)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(products)
}
