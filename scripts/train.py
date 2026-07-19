import os
import json
import numpy as np
import pandas as pd
import yfinance as yf
import lightgbm as lgb

# List of highly liquid Nifty 50 stocks to download training data for
TRAINING_SYMBOLS = [
    "RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "ICICIBANK.NS",
    "HINDUNILVR.NS", "ITC.NS", "SBIN.NS", "BHARTIARTL.NS", "LTIM.NS",
    "KOTAKBANK.NS", "LT.NS", "AXISBANK.NS", "ASIANPAINT.NS", "MARUTI.NS",
    "TITAN.NS", "SUNPHARMA.NS", "ULTRACEMCO.NS", "BAJFINANCE.NS", "WIPRO.NS",
    "JSWSTEEL.NS", "TATASTEEL.NS", "ADANIENT.NS", "NTPC.NS", "POWERGRID.NS"
]

def compute_indicators(df):
    """
    Computes technical indicators matching the TypeScript logic exactly.
    """
    close = df['Close']
    high = df['High']
    low = df['Low']
    volume = df['Volume']
    
    # 1. Simple Moving Averages
    df['sma20'] = close.rolling(window=20).mean()
    df['sma50'] = close.rolling(window=50).mean()
    df['sma200'] = close.rolling(window=200).mean()
    
    # 2. Exponential Moving Averages
    df['ema9'] = close.ewm(span=9, adjust=False).mean()
    df['ema21'] = close.ewm(span=21, adjust=False).mean()
    df['ema50'] = close.ewm(span=50, adjust=False).mean()
    df['ema200'] = close.ewm(span=200, adjust=False).mean()
    
    # 3. RSI (Wilder's Smoothing)
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.rolling(window=14).mean()
    avg_loss = loss.rolling(window=14).mean()
    
    # Apply Wilder's smoothing recursively
    avg_gain_vals = avg_gain.values
    avg_loss_vals = avg_loss.values
    gain_vals = gain.values
    loss_vals = loss.values
    
    for idx in range(14, len(df)):
        avg_gain_vals[idx] = (avg_gain_vals[idx-1] * 13 + gain_vals[idx]) / 14
        avg_loss_vals[idx] = (avg_loss_vals[idx-1] * 13 + loss_vals[idx]) / 14
        
    avg_gain_smooth = pd.Series(avg_gain_vals, index=df.index)
    avg_loss_smooth = pd.Series(avg_loss_vals, index=df.index)
    rs = avg_gain_smooth / avg_loss_smooth.replace(0, np.nan)
    df['rsi14'] = 100 - (100 / (1 + rs))
    df['rsi14'] = df['rsi14'].fillna(100)
    
    # 4. MACD (12, 26, 9)
    df['macd'] = close.ewm(span=12, adjust=False).mean() - close.ewm(span=26, adjust=False).mean()
    df['macdSignal'] = df['macd'].ewm(span=9, adjust=False).mean()
    df['macdHist'] = df['macd'] - df['macdSignal']
    
    # 5. Bollinger Bands (20, 2σ)
    std = close.rolling(window=20).std(ddof=0)
    df['bbUpper'] = df['sma20'] + 2 * std
    df['bbLower'] = df['sma20'] - 2 * std
    df['bbPercentB'] = (close - df['bbLower']) / (df['bbUpper'] - df['bbLower']).replace(0, np.nan)
    df['bbPercentB'] = df['bbPercentB'].fillna(0.5)
    df['bbBandwidth'] = (df['bbUpper'] - df['bbLower']) / df['sma20'].replace(0, np.nan)
    
    # 6. ATR (14, Wilder's Smoothing)
    tr1 = high - low
    tr2 = (high - close.shift()).abs()
    tr3 = (low - close.shift()).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    
    atr_vals = tr.rolling(window=14).mean().values
    tr_vals = tr.values
    for idx in range(14, len(df)):
        atr_vals[idx] = (atr_vals[idx-1] * 13 + tr_vals[idx]) / 14
    df['atr14'] = pd.Series(atr_vals, index=df.index)
    
    # 7. ADX (14, Wilder's Smoothing)
    up_move = high.diff()
    down_move = low.shift() - low
    plus_dm = np.where((up_move > down_move) & (up_move > 0), up_move, 0)
    minus_dm = np.where((down_move > up_move) & (down_move > 0), down_move, 0)
    
    tr_smooth = tr.rolling(window=14).mean().values
    plus_dm_smooth = pd.Series(plus_dm).rolling(window=14).mean().values
    minus_dm_smooth = pd.Series(minus_dm).rolling(window=14).mean().values
    
    for idx in range(14, len(df)):
        tr_smooth[idx] = tr_smooth[idx-1] * 13/14 + tr_vals[idx]
        plus_dm_smooth[idx] = plus_dm_smooth[idx-1] * 13/14 + plus_dm[idx]
        minus_dm_smooth[idx] = minus_dm_smooth[idx-1] * 13/14 + minus_dm[idx]
        
    plus_di = np.where(tr_smooth == 0, 0, (plus_dm_smooth / tr_smooth) * 100)
    minus_di = np.where(tr_smooth == 0, 0, (minus_dm_smooth / tr_smooth) * 100)
    
    di_sum = plus_di + minus_di
    dx = np.where(di_sum == 0, 0, (np.abs(plus_di - minus_di) / di_sum) * 100)
    
    dx_vals = pd.Series(dx).values
    adx_vals = pd.Series(dx).rolling(window=14).mean().values
    for idx in range(28, len(df)):
        adx_vals[idx] = (adx_vals[idx-1] * 13 + dx_vals[idx]) / 14
    df['adx'] = pd.Series(adx_vals, index=df.index)
    
    # 8. VWAP (20 rolling typical price)
    tp = (high + low + close) / 3
    df['vwap20'] = (tp * volume).rolling(window=20).sum() / volume.rolling(window=20).sum()
    
    # 9. Volume Ratio (latest volume vs 20-day average)
    avg_vol = volume.rolling(window=20).mean()
    df['volumeRatio'] = volume / avg_vol.replace(0, np.nan)
    df['volumeRatio'] = df['volumeRatio'].fillna(1.0)
    
    # 10. Multi-day Returns
    df['ret5d'] = close.pct_change(periods=5) * 100
    df['ret20d'] = close.pct_change(periods=20) * 100
    df['ret50d'] = close.pct_change(periods=50) * 100
    
    # 11. Distance from 200 DMA (%)
    df['distFrom200'] = ((close - df['sma200']) / df['sma200']) * 100
    
    return df

def generate_labels(df, forward_window=10, target_return=5.0):
    """
    Labels row i as 1 if the maximum future close price in [i+1, i+forward_window]
    is >= target_return% higher than close[i].
    """
    close = df['Close']
    labels = np.zeros(len(df))
    
    # Vectorized check for future rolling max return
    for offset in range(1, forward_window + 1):
        future_return = (close.shift(-offset) - close) / close * 100
        labels = np.where(future_return >= target_return, 1, labels)
        
    # Mask final rows that don't have enough forward lookahead
    labels[-forward_window:] = np.nan
    df['target'] = labels
    return df

def main():
    print("Downloading historical stock data from Yahoo Finance...")
    all_data = []
    
    # We download 5 years of historical daily data
    start_date = "2020-01-01"
    end_date = "2026-07-01"
    
    for symbol in TRAINING_SYMBOLS:
        try:
            print(f"Fetching {symbol}...")
            df = yf.download(symbol, start=start_date, end=end_date, progress=False)
            if df.empty or len(df) < 300:
                continue
                
            # Flatten multi-index if returned by yfinance
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
                
            df = compute_indicators(df)
            df = generate_labels(df)
            df = df.dropna() # Remove initial rows without indicators and final rows without labels
            all_data.append(df)
        except Exception as e:
            print(f"Error processing {symbol}: {e}")
            
    if not all_data:
        print("No stock data was fetched. Exiting.")
        return
        
    dataset = pd.concat(all_data)
    print(f"Total training dataset size: {len(dataset)} rows.")
    
    # Features list matching index order in TypeScript
    feature_cols = [
        'rsi14', 'macd', 'macdSignal', 'macdHist', 'adx', 
        'bbPercentB', 'bbBandwidth', 'volumeRatio', 'ret5d', 
        'ret20d', 'ret50d', 'distFrom200'
    ]
    
    X = dataset[feature_cols]
    y = dataset['target']
    
    # Define LightGBM Dataset
    train_data = lgb.Dataset(X, label=y)
    
    # Configure model to be shallow to avoid overfitting and keep JSON size very small
    params = {
        'objective': 'binary',
        'metric': 'binary_logloss',
        'boosting_type': 'gbdt',
        'learning_rate': 0.05,
        'max_depth': 4,
        'num_leaves': 15,
        'min_data_in_leaf': 50,
        'feature_fraction': 0.8,
        'bagging_fraction': 0.8,
        'bagging_freq': 5,
        'verbosity': -1
    }
    
    print("Training LightGBM classifier...")
    # Train model
    model = lgb.train(
        params,
        train_data,
        num_boost_round=60
    )
    
    # Dump tree structure to JSON
    model_json = model.dump_model()
    
    # Output path
    output_dir = "src/lib/predictor"
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "model.json")
    
    with open(output_path, 'w') as f:
        json.dump(model_json, f, indent=2)
        
    print(f"LightGBM JSON model successfully saved to: {output_path}")
    print("Model features:")
    for idx, col in enumerate(feature_cols):
        print(f"  Feature {idx}: {col}")

if __name__ == "__main__":
    main()
