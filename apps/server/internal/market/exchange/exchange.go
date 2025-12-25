package exchange

import (
	_ "embed" // Required for the go:embed directive
	"encoding/json"
	"fmt"
	"log"
)

//go:embed exchanges.json
var exchangesData []byte

type Exchange struct {
	URL      string `json:"url"`
	Requires struct {
		ApiKey         *bool  `json:"apiKey"`
		RequestSizeCap *int32 `json:"requestSizeCap"`
	} `json:"requires,omitempty"`
}

type Exchanges struct {
	Stocks map[string]Exchange `json:"stocks"`
	Crypto map[string]Exchange `json:"crypto"`
}

type ExchangeConfig struct {
	Url            string
	ApiKey         *string
	RequestSizeCap *int32
	Exchange       Exchange
}

var (
	AllExchanges Exchanges = LoadExchanges()
)

func GetExchangeInfo(exchangeName, assetType string) (Exchange, error) {
	switch assetType {

	case "crypto":
		if _, ok := AllExchanges.Crypto[exchangeName]; !ok {
			return Exchange{}, fmt.Errorf("exchange %s not found\n", exchangeName)
		}

		return AllExchanges.Crypto[exchangeName], nil

	case "stock":
		if _, ok := AllExchanges.Stocks[exchangeName]; !ok {
			return Exchange{}, fmt.Errorf("exchange %s not found\n", exchangeName)
		}

		return AllExchanges.Stocks[exchangeName], nil

	default:
		return Exchange{}, fmt.Errorf("asset type %s not supported\n", assetType)
	}
}

func LoadExchanges() Exchanges {
	var exchanges Exchanges

	err := json.Unmarshal(exchangesData, &exchanges)
	if err != nil {
		log.Panicf("could not unmarshal embedded exchanges: %v\n", err)
	}

	return exchanges
}
