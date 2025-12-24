package market

type Candlestick struct {
	Timestamp int64
	Low       float64
	High      float64
	Open      float64
	Close     float64
	Volume    float64
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
