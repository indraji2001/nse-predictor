import yfinance as yf

def test():
    for symbol in ["AAPL", "TCS.NS"]:
        try:
            ticker = yf.Ticker(symbol)
            df = ticker.get_upgrades_downgrades()
            print(f"--- {symbol} Upgrades/Downgrades ---")
            if df is not None and not df.empty:
                print(df.tail(5))
            else:
                print("No upgrades/downgrades data found.")
        except Exception as e:
            print(f"Error for {symbol}:", e)

if __name__ == "__main__":
    test()
