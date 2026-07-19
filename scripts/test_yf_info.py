import yfinance as yf

def test():
    symbol = "TCS.NS"
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        print("--- TCS.NS Info ---")
        print("targetMeanPrice:", info.get("targetMeanPrice"))
        print("recommendationMean:", info.get("recommendationMean"))
        print("recommendationKey:", info.get("recommendationKey"))
        print("numberOfAnalystOpinions:", info.get("numberOfAnalystOpinions"))
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test()
