// NSE Stock Universe — top liquid names across Nifty 50, Next 50, and active midcaps.
// Each stock carries a base price and a sector tag, used by the synthetic data engine
// to generate realistic OHLC series when a live data feed is not wired in.

export type Sector =
  | 'IT'
  | 'Banking'
  | 'FMCG'
  | 'Pharma'
  | 'Auto'
  | 'Energy'
  | 'Metals'
  | 'Infra'
  | 'Telecom'
  | 'Financials'
  | 'Chemicals'
  | 'Consumer'
  | 'Power'
  | 'Realty'
  | 'Media'

export interface StockMeta {
  symbol: string
  name: string
  sector: Sector
  basePrice: number
  // Annualized volatility (e.g. 0.22 = 22%)
  volatility: number
  // Annualized drift bias (positive = uptrend bias)
  drift: number
  // Optional Yahoo Finance ticker override (defaults to `{symbol}.NS`).
  // Use this when the Yahoo ticker differs from the NSE symbol.
  yahooSymbol?: string
}

// 80 highly liquid NSE stocks — covers large caps + popular midcaps.
export const NSE_UNIVERSE: StockMeta[] = [
  // IT
  { symbol: 'TCS', name: 'Tata Consultancy Services', sector: 'IT', basePrice: 3850, volatility: 0.22, drift: 0.14 },
  { symbol: 'INFY', name: 'Infosys', sector: 'IT', basePrice: 1620, volatility: 0.24, drift: 0.10 },
  { symbol: 'WIPRO', name: 'Wipro', sector: 'IT', basePrice: 540, volatility: 0.26, drift: 0.08 },
  { symbol: 'HCLTECH', name: 'HCL Technologies', sector: 'IT', basePrice: 1740, volatility: 0.23, drift: 0.13 },
  { symbol: 'TECHM', name: 'Tech Mahindra', sector: 'IT', basePrice: 1620, volatility: 0.27, drift: 0.07 },
  { symbol: 'LTM', name: 'LTIMindtree', sector: 'IT', basePrice: 5420, volatility: 0.26, drift: 0.10 },
  { symbol: 'PERSISTENT', name: 'Persistent Systems', sector: 'IT', basePrice: 4980, volatility: 0.30, drift: 0.22 },
  { symbol: 'COFORGE', name: 'Coforge', sector: 'IT', basePrice: 5740, volatility: 0.28, drift: 0.18 },

  // Banking & Financials
  { symbol: 'HDFCBANK', name: 'HDFC Bank', sector: 'Banking', basePrice: 1680, volatility: 0.20, drift: 0.10 },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', sector: 'Banking', basePrice: 1180, volatility: 0.22, drift: 0.13 },
  { symbol: 'SBIN', name: 'State Bank of India', sector: 'Banking', basePrice: 820, volatility: 0.24, drift: 0.12 },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank', sector: 'Banking', basePrice: 1760, volatility: 0.21, drift: 0.07 },
  { symbol: 'AXISBANK', name: 'Axis Bank', sector: 'Banking', basePrice: 1120, volatility: 0.23, drift: 0.09 },
  { symbol: 'INDUSINDBK', name: 'IndusInd Bank', sector: 'Banking', basePrice: 985, volatility: 0.27, drift: -0.02 },
  { symbol: 'BANKBARODA', name: 'Bank of Baroda', sector: 'Banking', basePrice: 235, volatility: 0.30, drift: 0.14 },
  { symbol: 'PNB', name: 'Punjab National Bank', sector: 'Banking', basePrice: 102, volatility: 0.32, drift: 0.10 },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance', sector: 'Financials', basePrice: 7180, volatility: 0.25, drift: 0.11 },
  { symbol: 'BAJFINSV', name: 'Bajaj Finserv', sector: 'Financials', basePrice: 1680, volatility: 0.22, drift: 0.10, yahooSymbol: 'BAJAJFINSV.NS' },
  { symbol: 'JIOFIN', name: 'Jio Financial Services', sector: 'Financials', basePrice: 320, volatility: 0.28, drift: 0.08 },
  { symbol: 'CHOLAFIN', name: 'Cholamandalam Investment', sector: 'Financials', basePrice: 1420, volatility: 0.26, drift: 0.16 },
  { symbol: 'SHRIRAMFIN', name: 'Shriram Finance', sector: 'Financials', basePrice: 580, volatility: 0.27, drift: 0.18 },

  // FMCG
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever', sector: 'FMCG', basePrice: 2580, volatility: 0.18, drift: 0.06 },
  { symbol: 'ITC', name: 'ITC Limited', sector: 'FMCG', basePrice: 460, volatility: 0.19, drift: 0.09 },
  { symbol: 'NESTLEIND', name: 'Nestle India', sector: 'FMCG', basePrice: 2480, volatility: 0.18, drift: 0.07 },
  { symbol: 'BRITANNIA', name: 'Britannia Industries', sector: 'FMCG', basePrice: 5120, volatility: 0.20, drift: 0.08 },
  { symbol: 'DABUR', name: 'Dabur India', sector: 'FMCG', basePrice: 530, volatility: 0.21, drift: 0.05 },
  { symbol: 'MARICO', name: 'Marico', sector: 'FMCG', basePrice: 620, volatility: 0.21, drift: 0.07 },
  { symbol: 'GODREJCP', name: 'Godrej Consumer Products', sector: 'FMCG', basePrice: 1180, volatility: 0.22, drift: 0.08 },
  { symbol: 'TATACONSUM', name: 'Tata Consumer Products', sector: 'FMCG', basePrice: 1080, volatility: 0.22, drift: 0.10 },

  // Pharma
  { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical', sector: 'Pharma', basePrice: 1740, volatility: 0.22, drift: 0.16 },
  { symbol: 'DRREDDY', name: 'Dr. Reddy’s Laboratories', sector: 'Pharma', basePrice: 1320, volatility: 0.22, drift: 0.10 },
  { symbol: 'CIPLA', name: 'Cipla', sector: 'Pharma', basePrice: 1560, volatility: 0.22, drift: 0.12 },
  { symbol: 'DIVISLAB', name: 'Divi’s Laboratories', sector: 'Pharma', basePrice: 5960, volatility: 0.24, drift: 0.09 },
  { symbol: 'APOLLOHOSP', name: 'Apollo Hospitals', sector: 'Pharma', basePrice: 6840, volatility: 0.24, drift: 0.15 },
  { symbol: 'AUROPHARMA', name: 'Aurobindo Pharma', sector: 'Pharma', basePrice: 1240, volatility: 0.27, drift: 0.13 },
  { symbol: 'LUPIN', name: 'Lupin', sector: 'Pharma', basePrice: 1980, volatility: 0.25, drift: 0.17 },
  { symbol: 'TORNTPHARM', name: 'Torrent Pharmaceuticals', sector: 'Pharma', basePrice: 3120, volatility: 0.23, drift: 0.16 },

  // Auto
  { symbol: 'MARUTI', name: 'Maruti Suzuki India', sector: 'Auto', basePrice: 12840, volatility: 0.22, drift: 0.11 },
  { symbol: 'TMPV', name: 'Tata Motors', sector: 'Auto', basePrice: 985, volatility: 0.30, drift: 0.12 },
  { symbol: 'M&M', name: 'Mahindra & Mahindra', sector: 'Auto', basePrice: 2920, volatility: 0.25, drift: 0.20, yahooSymbol: 'M&M.NS' },
  { symbol: 'BAJAJ-AUTO', name: 'Bajaj Auto', sector: 'Auto', basePrice: 9420, volatility: 0.24, drift: 0.15 },
  { symbol: 'HEROMOTOCO', name: 'Hero MotoCorp', sector: 'Auto', basePrice: 5240, volatility: 0.24, drift: 0.09 },
  { symbol: 'EICHERMOT', name: 'Eicher Motors', sector: 'Auto', basePrice: 4860, volatility: 0.25, drift: 0.14 },
  { symbol: 'ASHOKLEY', name: 'Ashok Leyland', sector: 'Auto', basePrice: 218, volatility: 0.27, drift: 0.16 },
  { symbol: 'TVSMOTOR', name: 'TVS Motor Company', sector: 'Auto', basePrice: 2480, volatility: 0.26, drift: 0.18 },

  // Energy & Power
  { symbol: 'RELIANCE', name: 'Reliance Industries', sector: 'Energy', basePrice: 2940, volatility: 0.22, drift: 0.10 },
  { symbol: 'ONGC', name: 'Oil & Natural Gas Corp', sector: 'Energy', basePrice: 275, volatility: 0.26, drift: 0.12 },
  { symbol: 'NTPC', name: 'NTPC Limited', sector: 'Power', basePrice: 360, volatility: 0.24, drift: 0.15 },
  { symbol: 'POWERGRID', name: 'Power Grid Corporation', sector: 'Power', basePrice: 320, volatility: 0.22, drift: 0.13 },
  { symbol: 'COALINDIA', name: 'Coal India', sector: 'Energy', basePrice: 460, volatility: 0.25, drift: 0.11 },
  { symbol: 'GAIL', name: 'GAIL India', sector: 'Energy', basePrice: 220, volatility: 0.23, drift: 0.12 },
  { symbol: 'IOC', name: 'Indian Oil Corporation', sector: 'Energy', basePrice: 165, volatility: 0.24, drift: 0.10 },
  { symbol: 'BPCL', name: 'Bharat Petroleum', sector: 'Energy', basePrice: 320, volatility: 0.25, drift: 0.11 },
  { symbol: 'TATAPOWER', name: 'Tata Power', sector: 'Power', basePrice: 420, volatility: 0.27, drift: 0.18 },
  { symbol: 'ADANIGREEN', name: 'Adani Green Energy', sector: 'Power', basePrice: 1820, volatility: 0.34, drift: 0.14 },

  // Metals
  { symbol: 'TATASTEEL', name: 'Tata Steel', sector: 'Metals', basePrice: 155, volatility: 0.28, drift: 0.09 },
  { symbol: 'JSWSTEEL', name: 'JSW Steel', sector: 'Metals', basePrice: 940, volatility: 0.26, drift: 0.10 },
  { symbol: 'HINDALCO', name: 'Hindalco Industries', sector: 'Metals', basePrice: 685, volatility: 0.28, drift: 0.13 },
  { symbol: 'VEDL', name: 'Vedanta', sector: 'Metals', basePrice: 460, volatility: 0.30, drift: 0.12 },
  { symbol: 'JINDALSTEL', name: 'Jindal Steel & Power', sector: 'Metals', basePrice: 940, volatility: 0.28, drift: 0.14 },
  { symbol: 'SAIL', name: 'Steel Authority of India', sector: 'Metals', basePrice: 175, volatility: 0.30, drift: 0.11 },
  { symbol: 'NATIONALUM', name: 'National Aluminium', sector: 'Metals', basePrice: 220, volatility: 0.30, drift: 0.13 },
  { symbol: 'HINDZINC', name: 'Hindustan Zinc', sector: 'Metals', basePrice: 510, volatility: 0.27, drift: 0.10 },

  // Infra / Construction / Cement
  { symbol: 'LT', name: 'Larsen & Toubro', sector: 'Infra', basePrice: 3620, volatility: 0.22, drift: 0.14 },
  { symbol: 'ULTRACEMCO', name: 'UltraTech Cement', sector: 'Infra', basePrice: 11400, volatility: 0.22, drift: 0.10 },
  { symbol: 'GRASIM', name: 'Grasim Industries', sector: 'Infra', basePrice: 2620, volatility: 0.23, drift: 0.12 },
  { symbol: 'SHREECEM', name: 'Shree Cement', sector: 'Infra', basePrice: 24800, volatility: 0.22, drift: 0.07 },
  { symbol: 'AMBUJACEM', name: 'Ambuja Cements', sector: 'Infra', basePrice: 620, volatility: 0.24, drift: 0.10 },
  { symbol: 'ACC', name: 'ACC Limited', sector: 'Infra', basePrice: 2240, volatility: 0.23, drift: 0.08 },
  { symbol: 'DLF', name: 'DLF Limited', sector: 'Realty', basePrice: 820, volatility: 0.27, drift: 0.20 },
  { symbol: 'GODREJPROP', name: 'Godrej Properties', sector: 'Realty', basePrice: 3120, volatility: 0.30, drift: 0.18 },
  { symbol: 'INDHOTEL', name: 'Indian Hotels Company', sector: 'Consumer', basePrice: 720, volatility: 0.26, drift: 0.22, yahooSymbol: 'INDHOTEL.NS' },

  // Telecom & Media
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel', sector: 'Telecom', basePrice: 1620, volatility: 0.22, drift: 0.18 },
  { symbol: 'IDEA', name: 'Vodafone Idea', sector: 'Telecom', basePrice: 12.5, volatility: 0.40, drift: -0.05 },
  { symbol: 'INDUSTOWER', name: 'Indus Towers', sector: 'Telecom', basePrice: 410, volatility: 0.25, drift: 0.16, yahooSymbol: 'INDUSTOWER.NS' },
  { symbol: 'SUNTV', name: 'Sun TV Network', sector: 'Media', basePrice: 720, volatility: 0.24, drift: 0.10 },
  { symbol: 'ZEEENT', name: 'Zee Entertainment', sector: 'Media', basePrice: 145, volatility: 0.32, drift: 0.06, yahooSymbol: 'ZEEL.NS' },

  // Consumer / Retail / Chemicals
  { symbol: 'TITAN', name: 'Titan Company', sector: 'Consumer', basePrice: 3480, volatility: 0.22, drift: 0.13 },
  { symbol: 'ASIANPAINT', name: 'Asian Paints', sector: 'Consumer', basePrice: 2880, volatility: 0.21, drift: 0.06 },
  { symbol: 'PIDILITIND', name: 'Pidilite Industries', sector: 'Chemicals', basePrice: 3120, volatility: 0.22, drift: 0.12 },
  { symbol: 'BERGEPAINT', name: 'Berger Paints', sector: 'Chemicals', basePrice: 540, volatility: 0.23, drift: 0.11 },
  { symbol: 'DMART', name: 'Avenue Supermarts', sector: 'Consumer', basePrice: 3820, volatility: 0.22, drift: 0.08 },
  { symbol: 'TRENT', name: 'Trent Limited', sector: 'Consumer', basePrice: 6420, volatility: 0.28, drift: 0.32 },
  { symbol: 'ZOMATO', name: 'Zomato Limited', sector: 'Consumer', basePrice: 245, volatility: 0.38, drift: 0.35, yahooSymbol: 'ETERNAL.NS' },
  { symbol: 'NYKAA', name: 'FSN E-Commerce', sector: 'Consumer', basePrice: 195, volatility: 0.35, drift: 0.12 },

  // Misc / Others
  { symbol: 'ADANIENT', name: 'Adani Enterprises', sector: 'Infra', basePrice: 2940, volatility: 0.34, drift: 0.20 },
  { symbol: 'ADANIPORTS', name: 'Adani Ports & SEZ', sector: 'Infra', basePrice: 1380, volatility: 0.28, drift: 0.20 },
  { symbol: 'SIEMENS', name: 'Siemens India', sector: 'Infra', basePrice: 7240, volatility: 0.26, drift: 0.22 },
  { symbol: 'ABB', name: 'ABB India', sector: 'Infra', basePrice: 7420, volatility: 0.26, drift: 0.24 },
  { symbol: 'BEL', name: 'Bharat Electronics', sector: 'Infra', basePrice: 280, volatility: 0.28, drift: 0.28 },
  { symbol: 'HAL', name: 'Hindustan Aeronautics', sector: 'Infra', basePrice: 4280, volatility: 0.27, drift: 0.30 },
  { symbol: 'BHEL', name: 'Bharat Heavy Electricals', sector: 'Infra', basePrice: 245, volatility: 0.30, drift: 0.15 },
  { symbol: 'IRCTC', name: 'Indian Railway Catering', sector: 'Consumer', basePrice: 820, volatility: 0.30, drift: 0.10 },
  { symbol: 'INDIGO', name: 'InterGlobe Aviation', sector: 'Consumer', basePrice: 4480, volatility: 0.28, drift: 0.25 },
]

// Merge with the expanded nifty500 list (additional stocks beyond the
// original 94 — brings the total universe to ~500 liquid NSE names).
import { UNIQUE_ADDITIONAL } from './nifty500'
import { UNIQUE_EXTRAS } from './nifty500-extras'

// De-duplicate against the original 94 (in case the expanded list contains
// any symbol that was already in NSE_UNIVERSE).
const _coreSymbols = new Set(NSE_UNIVERSE.map((s) => s.symbol))
const _extras = [...UNIQUE_ADDITIONAL, ...UNIQUE_EXTRAS].filter((s) => !_coreSymbols.has(s.symbol))

// Final merged universe (~500 stocks). Append the extras to NSE_UNIVERSE
// in place so any code that imports NSE_UNIVERSE automatically sees all ~500.
NSE_UNIVERSE.push(..._extras)

// Also export ALL_STOCKS as an alias for clarity.
export { NSE_UNIVERSE as ALL_STOCKS }

export const SECTORS: Sector[] = [
  'IT', 'Banking', 'FMCG', 'Pharma', 'Auto', 'Energy', 'Metals',
  'Infra', 'Telecom', 'Financials', 'Chemicals', 'Consumer', 'Power', 'Realty', 'Media',
]
