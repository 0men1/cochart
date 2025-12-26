package market

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
