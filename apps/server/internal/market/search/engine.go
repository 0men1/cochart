package search

import (
	"sort"
	"strings"
	"sync/atomic"
)

type Symbol struct {
	Symbol   string
	Ticker   string
	Exchange string
	Type     string
}
type Engine struct {
	symbols atomic.Value
}

func NewEngine() *Engine {
	e := &Engine{}
	e.symbols.Store(&[]Symbol{})
	return e
}

func (e *Engine) Search(query string, limit int) []Symbol {
	ptr := e.symbols.Load().(*[]Symbol)
	data := *ptr

	if query == "" {
		return []Symbol{}
	}

	idx := sort.Search(len(data), func(i int) bool {
		return data[i].Ticker >= query
	})

	results := make([]Symbol, 0, limit)
	for i := idx; i < len(data) && len(results) < limit; i++ {
		if !strings.HasPrefix(data[i].Ticker, query) {
			break
		}

		results = append(results, data[i])

		if len(results) >= limit {
			break
		}
	}

	return results
}

func (e *Engine) Update() error {
	return nil
}
