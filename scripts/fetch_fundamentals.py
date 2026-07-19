import os
import re
import json
import concurrent.futures
import yfinance as yf

# Paths to stock definition files
STOCK_FILES = [
    "src/lib/stocks/universe.ts",
    "src/lib/stocks/nifty500.ts",
    "src/lib/stocks/nifty500-extras.ts"
]

def extract_symbols():
    """
    Extracts unique stock symbols from the TypeScript files using regex.
    """
    symbols = set()
    symbol_pattern = re.compile(r"symbol:\s*['\"]([A-Z0-9_\-]+)['\"]")
    
    for file_path in STOCK_FILES:
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                matches = symbol_pattern.findall(content)
                for sym in matches:
                    symbols.add(sym.upper())
    
    return sorted(list(symbols))

def fetch_single_fundamental(symbol):
    """
    Fetches fundamental metrics and broker recommendations for a single stock from Yahoo Finance.
    """
    yahoo_symbol = f"{symbol}.NS"
    try:
        ticker = yf.Ticker(yahoo_symbol)
        info = ticker.info
        
        if not info:
            return symbol, None
            
        # Extract metrics
        pe = info.get('trailingPE') or info.get('forwardPE')
        debt_to_equity = info.get('debtToEquity') # in % from yfinance (e.g. 38.4 means 38.4%)
        
        # heldPercentInsiders is the equivalent of Promoter Holding in India
        insider_held = info.get('heldPercentInsiders')
        promoter_held = (insider_held * 100) if insider_held is not None else None
        
        operating_margin = info.get('operatingMargins')
        margin_pct = (operating_margin * 100) if operating_margin is not None else None
        
        # Extract broker recommendations & price targets
        target_mean_price = info.get('targetMeanPrice')
        recommendation_key = info.get('recommendationKey')
        recommendation_mean = info.get('recommendationMean')
        analysts_count = info.get('numberOfAnalystOpinions')
        
        data = {
            "pe": round(pe, 2) if pe is not None else None,
            "debtToEquity": round(debt_to_equity, 2) if debt_to_equity is not None else None,
            "promoterHeld": round(promoter_held, 2) if promoter_held is not None else None,
            "margin": round(margin_pct, 2) if margin_pct is not None else None,
            "targetPrice": round(target_mean_price, 2) if target_mean_price is not None else None,
            "recommendation": recommendation_key if recommendation_key is not None else None,
            "recommendationMean": round(recommendation_mean, 2) if recommendation_mean is not None else None,
            "analystsCount": analysts_count if analysts_count is not None else None
        }
        return symbol, data
    except Exception as e:
        print(f"Error fetching {symbol}: {e}")
        return symbol, None

def main():
    print("Extracting symbols from project config...")
    symbols = extract_symbols()
    print(f"Found {len(symbols)} unique symbols.")
    
    if not symbols:
        print("No symbols found. Exiting.")
        return
        
    fundamentals = {}
    
    # We use a thread pool to fetch stock data concurrently and avoid taking hours
    max_workers = 16
    print(f"Fetching fundamentals using {max_workers} threads...")
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit tasks
        future_to_symbol = {executor.submit(fetch_single_fundamental, sym): sym for sym in symbols}
        
        completed = 0
        for future in concurrent.futures.as_completed(future_to_symbol):
            sym, data = future.result()
            completed += 1
            if data:
                fundamentals[sym] = data
            
            if completed % 25 == 0 or completed == len(symbols):
                print(f"Progress: {completed}/{len(symbols)} stocks fetched.")
                
    # Save to JSON
    output_path = "src/lib/stocks/fundamentals.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(fundamentals, f, indent=2, sort_keys=True)
        
    print(f"Fundamentals metadata successfully saved to: {output_path}")
    print(f"Successfully processed {len(fundamentals)} out of {len(symbols)} stocks.")

if __name__ == "__main__":
    main()
