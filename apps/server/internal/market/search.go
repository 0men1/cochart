package market

import (
	"sort"
	"strings"
	"sync"
)

type Engine struct {
	mu    sync.Mutex
	index []Product
}

func NewEngine(providers map[string]ExchangeProvider) *Engine {
	e := &Engine{
		index: make([]Product, 0),
	}
	e.BuildIndex(providers)
	return e
}

func (e *Engine) BuildIndex(providers map[string]ExchangeProvider) {
	e.mu.Lock()
	defer e.mu.Unlock()

	var agg []Product
	for _, p := range providers {
		products, err := p.GetProducts()
		if err != nil {
			continue
		}
		agg = append(agg, products...)
	}

	sort.Slice(agg, func(i, j int) bool {
		return agg[i].Name < agg[j].Name
	})

	e.index = agg
}

func (e *Engine) Search(query string, limit int) []Product {
	query = strings.ToUpper(query)

	if query == "" {
		return []Product{}
	}

	idx := sort.Search(len(e.index), func(i int) bool {
		return e.index[i].Name >= query
	})

	results := make([]Product, 0, limit)
	for i := idx; i < len(e.index) && len(results) < limit; i++ {
		if !strings.HasPrefix(e.index[i].Name, query) {
			break
		}
		results = append(results, e.index[i])
		if len(results) >= limit {
			break
		}
	}
	return results
}

func (e *Engine) Update() error {
	return nil
}
