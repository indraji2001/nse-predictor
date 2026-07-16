// Expanded NSE stock universe — ~500 stocks across Nifty 50, Next 50,
// Midcap 150, Smallcap 250, and popular SME/sector names.
// All symbols use NSE format. Yahoo fetcher uses {symbol}.NS by default;
// override `yahooSymbol` only when Yahoo's ticker differs.
//
// Sector tags follow the existing universe taxonomy so the sector breadth
// widget keeps working unchanged.

import { StockMeta } from './universe'

// Additional stocks beyond the original 94 — brings the universe to ~500.
// Organized by sector for easy maintenance. Prices/volatilities are rough
// estimates used only for synthetic fallback when both NSE and Yahoo fail.
export const ADDITIONAL_STOCKS: StockMeta[] = [
  // === IT & Technology Services (additional) ===
  { symbol: 'MPHASIS', name: 'Mphasis', sector: 'IT', basePrice: 2950, volatility: 0.25, drift: 0.12 },
  { symbol: 'OFSS', name: 'Oracle Financial Services', sector: 'IT', basePrice: 9800, volatility: 0.24, drift: 0.15 },
  { symbol: 'SONATSOFTW', name: 'Sonata Software', sector: 'IT', basePrice: 670, volatility: 0.30, drift: 0.18 },
  { symbol: 'TATAELXSI', name: 'Tata Elxsi', sector: 'IT', basePrice: 7400, volatility: 0.30, drift: 0.16 },
  { symbol: 'BSOFT', name: 'Birlasoft', sector: 'IT', basePrice: 580, volatility: 0.28, drift: 0.15 },
  { symbol: 'KELLTONTEC', name: 'Kellton Tech', sector: 'IT', basePrice: 95, volatility: 0.32, drift: 0.10 },
  { symbol: 'SASKEN', name: 'Sasken Technologies', sector: 'IT', basePrice: 1050, volatility: 0.30, drift: 0.10 },
  { symbol: 'RSSOFTWARE', name: 'RS Software', sector: 'IT', basePrice: 280, volatility: 0.32, drift: 0.08 },
  { symbol: '3IINFOLTD', name: '3i Infotech', sector: 'IT', basePrice: 65, volatility: 0.35, drift: 0.06 },
  { symbol: 'NIITLTD', name: 'NIIT Limited', sector: 'IT', basePrice: 165, volatility: 0.30, drift: 0.08 },
  { symbol: 'CELESTIAL', name: 'Celestial Biolabs', sector: 'IT', basePrice: 45, volatility: 0.35, drift: 0.05 },
  { symbol: 'QUICKHEAL', name: 'Quick Heal Technologies', sector: 'IT', basePrice: 450, volatility: 0.28, drift: 0.07 },
  { symbol: 'NEWGEN', name: 'Newgen Software', sector: 'IT', basePrice: 850, volatility: 0.30, drift: 0.18 },
  { symbol: 'RSYSTEMS', name: 'R Systems International', sector: 'IT', basePrice: 280, volatility: 0.28, drift: 0.12 },
  { symbol: 'KFINTECH', name: 'KFin Technologies', sector: 'IT', basePrice: 850, volatility: 0.27, drift: 0.20 },
  { symbol: 'CDSL', name: 'Central Depository Services', sector: 'IT', basePrice: 1850, volatility: 0.28, drift: 0.25 },
  { symbol: 'CAMSSYSTEMS', name: 'CMC Systems', sector: 'IT', basePrice: 1620, volatility: 0.25, drift: 0.10 },
  { symbol: 'ECLOTS', name: 'Eclerx Services', sector: 'IT', basePrice: 2350, volatility: 0.26, drift: 0.10 },
  { symbol: 'ZENTEC', name: 'Zen Technologies', sector: 'IT', basePrice: 980, volatility: 0.32, drift: 0.22 },
  { symbol: 'INFIBEAM', name: 'Infibeam Avenues', sector: 'IT', basePrice: 22, volatility: 0.35, drift: 0.08 },

  // === Banking (additional PSU + private) ===
  { symbol: 'IDBI', name: 'IDBI Bank', sector: 'Banking', basePrice: 80, volatility: 0.28, drift: 0.10 },
  { symbol: 'CANBK', name: 'Canara Bank', sector: 'Banking', basePrice: 105, volatility: 0.28, drift: 0.12 },
  { symbol: 'FEDERALBNK', name: 'Federal Bank', sector: 'Banking', basePrice: 195, volatility: 0.25, drift: 0.14 },
  { symbol: 'SBICARD', name: 'SBI Cards & Payments', sector: 'Banking', basePrice: 780, volatility: 0.26, drift: 0.10 },
  { symbol: 'AUBANK', name: 'AU Small Finance Bank', sector: 'Banking', basePrice: 620, volatility: 0.27, drift: 0.13 },
  { symbol: 'REPCAPITAL', name: 'Repco Home Finance', sector: 'Banking', basePrice: 320, volatility: 0.28, drift: 0.08 },
  { symbol: 'IIFL', name: 'IIFL Finance', sector: 'Banking', basePrice: 420, volatility: 0.30, drift: 0.15 },
  { symbol: 'UCOBANK', name: 'UCO Bank', sector: 'Banking', basePrice: 45, volatility: 0.30, drift: 0.10 },
  { symbol: 'SYNDIBANK', name: 'Syndicate Bank', sector: 'Banking', basePrice: 80, volatility: 0.30, drift: 0.08 },
  { symbol: 'MAHABANK', name: 'Bank of Maharashtra', sector: 'Banking', basePrice: 55, volatility: 0.30, drift: 0.13 },
  { symbol: 'IOB', name: 'Indian Overseas Bank', sector: 'Banking', basePrice: 55, volatility: 0.32, drift: 0.12 },
  { symbol: 'CENTRALBK', name: 'Central Bank of India', sector: 'Banking', basePrice: 50, volatility: 0.32, drift: 0.10 },
  { symbol: 'PSB', name: 'Punjab & Sind Bank', sector: 'Banking', basePrice: 35, volatility: 0.32, drift: 0.08 },

  // === Financials & NBFCs (additional) ===
  { symbol: 'MUTHOOTFIN', name: 'Muthoot Finance', sector: 'Financials', basePrice: 1980, volatility: 0.24, drift: 0.14 },
  { symbol: 'MANAPPURAM', name: 'Manappuram Finance', sector: 'Financials', basePrice: 195, volatility: 0.28, drift: 0.10 },
  { symbol: 'IIFLFIN', name: 'IIFL Finance', sector: 'Financials', basePrice: 420, volatility: 0.30, drift: 0.15 },
  { symbol: 'PFC', name: 'Power Finance Corporation', sector: 'Financials', basePrice: 430, volatility: 0.26, drift: 0.18 },
  { symbol: 'RECLTD', name: 'REC Limited', sector: 'Financials', basePrice: 510, volatility: 0.26, drift: 0.20 },
  { symbol: 'HDFCLIFE', name: 'HDFC Life Insurance', sector: 'Financials', basePrice: 680, volatility: 0.24, drift: 0.10 },
  { symbol: 'SBILIFE', name: 'SBI Life Insurance', sector: 'Financials', basePrice: 1480, volatility: 0.24, drift: 0.12 },
  { symbol: 'ICICIPRULI', name: 'ICICI Prudential Life', sector: 'Financials', basePrice: 580, volatility: 0.25, drift: 0.10 },
  { symbol: 'ICICIGI', name: 'ICICI Lombard', sector: 'Financials', basePrice: 1820, volatility: 0.24, drift: 0.13 },
  { symbol: 'LICI', name: 'Life Insurance Corp of India', sector: 'Financials', basePrice: 920, volatility: 0.22, drift: 0.08 },
  { symbol: 'GICRE', name: 'GIC Re', sector: 'Financials', basePrice: 280, volatility: 0.26, drift: 0.06 },
  { symbol: 'M&MFIN', name: 'Mahindra & Mahindra Financial', sector: 'Financials', basePrice: 290, volatility: 0.27, drift: 0.13 },
  { symbol: 'CREDITACC', name: 'CreditAccess Grameen', sector: 'Financials', basePrice: 980, volatility: 0.28, drift: 0.16 },
  { symbol: 'CAMLINFINE', name: 'Caplin Point Finance', sector: 'Financials', basePrice: 950, volatility: 0.25, drift: 0.10 },
  { symbol: 'LTF', name: 'L&T Finance', sector: 'Financials', basePrice: 165, volatility: 0.28, drift: 0.15 },
  { symbol: 'PIIND', name: 'Piramal Enterprises', sector: 'Financials', basePrice: 980, volatility: 0.27, drift: 0.10 },

  // === FMCG (additional) ===
  { symbol: 'COLPAL', name: 'Colgate-Palmolive', sector: 'FMCG', basePrice: 2480, volatility: 0.18, drift: 0.06 },
  { symbol: 'PGHH', name: 'Procter & Gamble Hygiene', sector: 'FMCG', basePrice: 14800, volatility: 0.20, drift: 0.07 },
  { symbol: 'GILLETTE', name: 'Gillette India', sector: 'FMCG', basePrice: 5800, volatility: 0.20, drift: 0.08 },
  { symbol: 'VSTIND', name: 'VST Industries', sector: 'FMCG', basePrice: 360, volatility: 0.22, drift: 0.06 },
  { symbol: 'GODREJAGRO', name: 'Godrej Agrovet', sector: 'FMCG', basePrice: 540, volatility: 0.24, drift: 0.08 },
  { symbol: 'HATSUN', name: 'Hatsun Agro Product', sector: 'FMCG', basePrice: 1050, volatility: 0.24, drift: 0.12 },
  { symbol: 'KRBL', name: 'KRBL Limited', sector: 'FMCG', basePrice: 380, volatility: 0.25, drift: 0.08 },
  { symbol: 'LTFOODS', name: 'LT Foods', sector: 'FMCG', basePrice: 75, volatility: 0.28, drift: 0.12 },
  { symbol: 'AVANTIFEED', name: 'Avanti Feeds', sector: 'FMCG', basePrice: 420, volatility: 0.26, drift: 0.10 },
  { symbol: 'MCDOWELL-N', name: 'United Spirits', sector: 'FMCG', basePrice: 1480, volatility: 0.24, drift: 0.13 },
  { symbol: 'UBL', name: 'United Breweries', sector: 'FMCG', basePrice: 1680, volatility: 0.22, drift: 0.08 },
  { symbol: 'RADICO', name: 'Radico Khaitan', sector: 'FMCG', basePrice: 1820, volatility: 0.25, drift: 0.15 },
  { symbol: 'GMMPFAUDLR', name: 'GMM Pfaudler', sector: 'FMCG', basePrice: 1380, volatility: 0.26, drift: 0.10 },

  // === Pharma & Healthcare (additional) ===
  { symbol: 'BIOCON', name: 'Biocon', sector: 'Pharma', basePrice: 340, volatility: 0.26, drift: 0.13 },
  { symbol: 'SYNGENE', name: 'Syngene International', sector: 'Pharma', basePrice: 720, volatility: 0.24, drift: 0.12 },
  { symbol: 'GLENMARK', name: 'Glenmark Pharma', sector: 'Pharma', basePrice: 1180, volatility: 0.26, drift: 0.10 },
  { symbol: 'CADILAHC', name: 'Zydus Lifesciences', sector: 'Pharma', basePrice: 980, volatility: 0.24, drift: 0.12 },
  { symbol: 'ABBOTINDIA', name: 'Abbott India', sector: 'Pharma', basePrice: 29800, volatility: 0.22, drift: 0.12 },
  { symbol: 'LAOPALA', name: 'La Opala RG', sector: 'Pharma', basePrice: 380, volatility: 0.26, drift: 0.08 },
  { symbol: 'WOCKPHARMA', name: 'Wockhardt', sector: 'Pharma', basePrice: 420, volatility: 0.32, drift: 0.05 },
  { symbol: 'NATCOPHARM', name: 'Natco Pharma', sector: 'Pharma', basePrice: 980, volatility: 0.27, drift: 0.13 },
  { symbol: 'IPCALAB', name: 'IPCA Laboratories', sector: 'Pharma', basePrice: 1280, volatility: 0.25, drift: 0.13 },
  { symbol: 'SANOFI', name: 'Sanofi India', sector: 'Pharma', basePrice: 9800, volatility: 0.22, drift: 0.06 },
  { symbol: 'ALEMBICLTD', name: 'Alembic Pharmaceuticals', sector: 'Pharma', basePrice: 980, volatility: 0.25, drift: 0.11 },
  { symbol: 'STARHEALTH', name: 'Star Health Insurance', sector: 'Pharma', basePrice: 540, volatility: 0.27, drift: 0.05 },
  { symbol: 'KOKUYO', name: 'Kokuyo Camlin', sector: 'Pharma', basePrice: 165, volatility: 0.26, drift: 0.08 },
  { symbol: 'HINDPETRO', name: 'Hindustan Petroleum', sector: 'Pharma', basePrice: 480, volatility: 0.25, drift: 0.10 },

  // === Auto & Auto Ancillaries (additional) ===
  { symbol: 'BOSCHLTD', name: 'Bosch Limited', sector: 'Auto', basePrice: 32400, volatility: 0.24, drift: 0.12 },
  { symbol: 'MRF', name: 'MRF Limited', sector: 'Auto', basePrice: 132000, volatility: 0.22, drift: 0.10 },
  { symbol: 'APOLLOTYRE', name: 'Apollo Tyres', sector: 'Auto', basePrice: 470, volatility: 0.27, drift: 0.13 },
  { symbol: 'CEATLTD', name: 'CEAT Limited', sector: 'Auto', basePrice: 2480, volatility: 0.27, drift: 0.16 },
  { symbol: 'JKTYRE', name: 'JK Tyre & Industries', sector: 'Auto', basePrice: 380, volatility: 0.28, drift: 0.13 },
  { symbol: 'EXIDEIND', name: 'Exide Industries', sector: 'Auto', basePrice: 480, volatility: 0.26, drift: 0.12 },
  { symbol: 'AMARAJABAT', name: 'Amara Raja Batteries', sector: 'Auto', basePrice: 980, volatility: 0.26, drift: 0.13 },
  { symbol: 'BALKRISIND', name: 'Balkrishna Industries', sector: 'Auto', basePrice: 2680, volatility: 0.26, drift: 0.10 },
  { symbol: 'MOTHERSON', name: 'Motherson Sumi Systems', sector: 'Auto', basePrice: 165, volatility: 0.28, drift: 0.14 },
  { symbol: 'BENDURABEN', name: 'Benteng Automotive', sector: 'Auto', basePrice: 145, volatility: 0.30, drift: 0.10 },
  { symbol: 'WABCOINDIA', name: 'Wabco India', sector: 'Auto', basePrice: 14800, volatility: 0.24, drift: 0.08 },
  { symbol: 'INFOMEDIA', name: 'Infomedia Press', sector: 'Auto', basePrice: 18, volatility: 0.35, drift: 0.05 },

  // === Energy & Power (additional) ===
  { symbol: 'ADANIPOWER', name: 'Adani Power', sector: 'Power', basePrice: 580, volatility: 0.30, drift: 0.18 },
  { symbol: 'JSWENERGY', name: 'JSW Energy', sector: 'Power', basePrice: 480, volatility: 0.27, drift: 0.14 },
  { symbol: 'NHPC', name: 'NHPC Limited', sector: 'Power', basePrice: 105, volatility: 0.24, drift: 0.10 },
  { symbol: 'SJVN', name: 'SJVN Limited', sector: 'Power', basePrice: 130, volatility: 0.26, drift: 0.15 },
  { symbol: 'SUZLON', name: 'Suzlon Energy', sector: 'Power', basePrice: 65, volatility: 0.35, drift: 0.25 },
  { symbol: 'INAQPORT', name: 'Ingersoll-Rand India', sector: 'Power', basePrice: 3200, volatility: 0.25, drift: 0.12 },
  { symbol: 'KSB', name: 'KSB Limited', sector: 'Power', basePrice: 3480, volatility: 0.25, drift: 0.15 },
  { symbol: 'TFIINFRA', name: 'Technofab Engineering', sector: 'Power', basePrice: 65, volatility: 0.30, drift: 0.08 },
  { symbol: 'ENERGYDEV', name: 'Energy Development', sector: 'Power', basePrice: 95, volatility: 0.30, drift: 0.08 },
  { symbol: 'IOTL', name: 'Indian Oil Terminals', sector: 'Power', basePrice: 95, volatility: 0.28, drift: 0.10 },

  // === Metals & Mining (additional) ===
  { symbol: 'APLAPOLLO', name: 'APL Apollo Tubes', sector: 'Metals', basePrice: 1480, volatility: 0.26, drift: 0.18 },
  { symbol: 'RATNAMANI', name: 'Ratnamani Metals', sector: 'Metals', basePrice: 2980, volatility: 0.26, drift: 0.14 },
  { symbol: 'WELCORP', name: 'Welspun Corp', sector: 'Metals', basePrice: 580, volatility: 0.28, drift: 0.16 },
  { symbol: 'MAHSEAMLES', name: 'Maharashtra Seamless', sector: 'Metals', basePrice: 980, volatility: 0.27, drift: 0.13 },
  { symbol: 'UTTAMSTL', name: 'Uttam Galva Steels', sector: 'Metals', basePrice: 28, volatility: 0.35, drift: 0.02 },
  { symbol: 'APLHIND', name: 'APL Apollo Holdings', sector: 'Metals', basePrice: 95, volatility: 0.30, drift: 0.08 },
  { symbol: 'NMDC', name: 'NMDC Limited', sector: 'Metals', basePrice: 230, volatility: 0.27, drift: 0.13 },
  { symbol: 'SILINV', name: 'Silverline Technologies', sector: 'Metals', basePrice: 25, volatility: 0.35, drift: 0.05 },
  { symbol: 'KIOCL', name: 'KIOCL Limited', sector: 'Metals', basePrice: 285, volatility: 0.30, drift: 0.10 },
  { symbol: 'GMDC', name: 'Gujarat Mineral Development', sector: 'Metals', basePrice: 285, volatility: 0.28, drift: 0.12 },
  { symbol: 'MIDHANI', name: 'Mishra Dhatu Nigam', sector: 'Metals', basePrice: 380, volatility: 0.28, drift: 0.10 },
  { symbol: 'NALCO', name: 'National Aluminium', sector: 'Metals', basePrice: 195, volatility: 0.28, drift: 0.12 },

  // === Infrastructure & Construction (additional) ===
  { symbol: 'ITCOLD', name: 'ITC Infotech', sector: 'Infra', basePrice: 480, volatility: 0.25, drift: 0.10 },
  { symbol: 'KNRCON', name: 'KNR Construction', sector: 'Infra', basePrice: 280, volatility: 0.28, drift: 0.12 },
  { symbol: 'PNCINFRA', name: 'PNC Infratech', sector: 'Infra', basePrice: 420, volatility: 0.28, drift: 0.15 },
  { symbol: 'HGICL', name: 'Hindustan Construction', sector: 'Infra', basePrice: 28, volatility: 0.32, drift: 0.05 },
  { symbol: 'NALWA', name: 'JSL Stainless', sector: 'Infra', basePrice: 680, volatility: 0.27, drift: 0.14 },
  { symbol: 'AJMERA', name: 'Ajmera Realty', sector: 'Infra', basePrice: 285, volatility: 0.28, drift: 0.12 },
  { symbol: 'BRIGADE', name: 'Brigade Enterprises', sector: 'Infra', basePrice: 1280, volatility: 0.27, drift: 0.14 },
  { symbol: 'OBEROIRLTY', name: 'Oberoi Realty', sector: 'Infra', basePrice: 1680, volatility: 0.26, drift: 0.16 },
  { symbol: 'PHOENIXLTD', name: 'Phoenix Mills', sector: 'Infra', basePrice: 1820, volatility: 0.26, drift: 0.15 },
  { symbol: 'PRESTIGE', name: 'Prestige Estates', sector: 'Infra', basePrice: 1380, volatility: 0.28, drift: 0.18 },
  { symbol: 'SOBHA', name: 'Sobha Limited', sector: 'Infra', basePrice: 1480, volatility: 0.28, drift: 0.13 },
  { symbol: 'GODREJIND', name: 'Godrej Industries', sector: 'Infra', basePrice: 980, volatility: 0.26, drift: 0.10 },

  // === Telecom & Media (additional) ===
  { symbol: 'INDUSIND-BK', name: 'IndusInd Bank', sector: 'Telecom', basePrice: 985, volatility: 0.27, drift: 0.08 },
  { symbol: 'TATACOMM', name: 'Tata Communications', sector: 'Telecom', basePrice: 1780, volatility: 0.26, drift: 0.14 },
  { symbol: 'TANLA', name: 'Tanla Platforms', sector: 'Telecom', basePrice: 980, volatility: 0.32, drift: 0.15 },
  { symbol: 'ROUTE', name: 'Route Mobile', sector: 'Telecom', basePrice: 1680, volatility: 0.30, drift: 0.12 },
  { symbol: 'MAHINDRATEL', name: 'Mahindra Comviva', sector: 'Telecom', basePrice: 285, volatility: 0.28, drift: 0.08 },
  { symbol: 'ONMOBILE', name: 'OnMobile Global', sector: 'Telecom', basePrice: 95, volatility: 0.30, drift: 0.06 },
  { symbol: 'TIPSINDLTD', name: 'Tips Industries', sector: 'Media', basePrice: 480, volatility: 0.32, drift: 0.18 },
  { symbol: 'PVRINOX', name: 'PVR INOX Limited', sector: 'Media', basePrice: 1480, volatility: 0.28, drift: 0.12 },
  { symbol: 'NETWORK18', name: 'Network18 Media', sector: 'Media', basePrice: 95, volatility: 0.30, drift: 0.10 },
  { symbol: 'TV18BRDCST', name: 'TV18 Broadcast', sector: 'Media', basePrice: 45, volatility: 0.32, drift: 0.05 },
  { symbol: 'HINDMEDIA', name: 'Hindustan Media Ventures', sector: 'Media', basePrice: 65, volatility: 0.30, drift: 0.05 },
  { symbol: 'JAGRAN', name: 'Jagran Prakashan', sector: 'Media', basePrice: 95, volatility: 0.27, drift: 0.05 },
  { symbol: 'MIDMORNING', name: 'Mid-day Multimedia', sector: 'Media', basePrice: 35, volatility: 0.32, drift: 0.03 },
  { symbol: 'SAREGAMA', name: 'Saregama India', sector: 'Media', basePrice: 480, volatility: 0.30, drift: 0.18 },
  { symbol: 'NXTDIGITAL', name: 'NXTDigital', sector: 'Media', basePrice: 95, volatility: 0.32, drift: 0.05 },

  // === Consumer Goods & Retail (additional) ===
  { symbol: 'BAJAJELEC', name: 'Bajaj Electricals', sector: 'Consumer', basePrice: 1180, volatility: 0.27, drift: 0.10 },
  { symbol: 'VBL', name: 'Varun Beverages', sector: 'Consumer', basePrice: 1480, volatility: 0.28, drift: 0.25 },
  { symbol: 'PGHL', name: 'Procter & Gamble Health', sector: 'Consumer', basePrice: 5800, volatility: 0.24, drift: 0.14 },
  { symbol: 'VOLTAS', name: 'Voltas Limited', sector: 'Consumer', basePrice: 1480, volatility: 0.26, drift: 0.13 },
  { symbol: 'CROMPTON', name: 'Crompton Greaves', sector: 'Consumer', basePrice: 420, volatility: 0.26, drift: 0.14 },
  { symbol: 'SYMPHONY', name: 'Symphony Limited', sector: 'Consumer', basePrice: 1080, volatility: 0.27, drift: 0.10 },
  { symbol: 'HAVELLS', name: 'Havells India', sector: 'Consumer', basePrice: 1680, volatility: 0.25, drift: 0.13 },
  { symbol: 'POLYCAB', name: 'Polycab India', sector: 'Consumer', basePrice: 6480, volatility: 0.27, drift: 0.18 },
  { symbol: 'KEI', name: 'KEI Industries', sector: 'Consumer', basePrice: 3480, volatility: 0.27, drift: 0.20 },
  { symbol: 'FINCABLES', name: 'Finolex Cables', sector: 'Consumer', basePrice: 1180, volatility: 0.25, drift: 0.14 },
  { symbol: 'RAMCOCEM', name: 'Ramco Cements', sector: 'Consumer', basePrice: 980, volatility: 0.25, drift: 0.10 },
  { symbol: 'HEG', name: 'HEG Limited', sector: 'Consumer', basePrice: 1980, volatility: 0.30, drift: 0.10 },
  { symbol: 'CARBORUNDUM', name: 'Carborundum Universal', sector: 'Consumer', basePrice: 1280, volatility: 0.25, drift: 0.12 },
  { symbol: 'WONDERLA', name: 'Wonderla Holidays', sector: 'Consumer', basePrice: 780, volatility: 0.28, drift: 0.15 },
  { symbol: 'EIHOTEL', name: 'EIH Limited', sector: 'Consumer', basePrice: 380, volatility: 0.27, drift: 0.13 },
  { symbol: 'CHALET', name: 'Chalet Hotels', sector: 'Consumer', basePrice: 780, volatility: 0.28, drift: 0.18 },
  { symbol: 'MAHLIFE', name: 'Mahindra Holidays', sector: 'Consumer', basePrice: 480, volatility: 0.26, drift: 0.12 },
  { symbol: 'TCIEXP', name: 'TCI Express', sector: 'Consumer', basePrice: 1480, volatility: 0.27, drift: 0.15 },
  { symbol: 'BLUECOAST', name: 'Blue Coast', sector: 'Consumer', basePrice: 380, volatility: 0.30, drift: 0.10 },
  { symbol: 'WWIL', name: 'Woodstock Wealth', sector: 'Consumer', basePrice: 95, volatility: 0.32, drift: 0.08 },

  // === Chemicals & Speciality (additional) ===
  { symbol: 'PIIND', name: 'PI Industries', sector: 'Chemicals', basePrice: 3880, volatility: 0.25, drift: 0.15 },
  { symbol: 'UPL', name: 'UPL Limited', sector: 'Chemicals', basePrice: 580, volatility: 0.27, drift: 0.10 },
  { symbol: 'SRF', name: 'SRF Limited', sector: 'Chemicals', basePrice: 2480, volatility: 0.26, drift: 0.14 },
  { symbol: 'TATACHEM', name: 'Tata Chemicals', sector: 'Chemicals', basePrice: 1080, volatility: 0.25, drift: 0.10 },
  { symbol: 'GUJALKALI', name: 'Gujarat Alkalies', sector: 'Chemicals', basePrice: 780, volatility: 0.26, drift: 0.10 },
  { symbol: 'GNFC', name: 'Gujarat Narmada Fertilizers', sector: 'Chemicals', basePrice: 680, volatility: 0.26, drift: 0.12 },
  { symbol: 'GSFC', name: 'Gujarat State Fertilizers', sector: 'Chemicals', basePrice: 240, volatility: 0.26, drift: 0.10 },
  { symbol: 'FACT', name: 'Fertilizers & Chemicals', sector: 'Chemicals', basePrice: 580, volatility: 0.30, drift: 0.18 },
  { symbol: 'RCF', name: 'Rashtriya Chemicals', sector: 'Chemicals', basePrice: 165, volatility: 0.28, drift: 0.13 },
  { symbol: 'COROMANDEL', name: 'Coromandel International', sector: 'Chemicals', basePrice: 1680, volatility: 0.25, drift: 0.13 },
  { symbol: 'CHAMBLFERT', name: 'Chambal Fertilizers', sector: 'Chemicals', basePrice: 420, volatility: 0.26, drift: 0.10 },
  { symbol: 'DEEPAKFERT', name: 'Deepak Fertilizers', sector: 'Chemicals', basePrice: 980, volatility: 0.27, drift: 0.15 },
  { symbol: 'MANGALAM', name: 'Mangalam Drugs', sector: 'Chemicals', basePrice: 285, volatility: 0.30, drift: 0.08 },
  { symbol: 'LINDEINDIA', name: 'Linde India', sector: 'Chemicals', basePrice: 6480, volatility: 0.25, drift: 0.15 },
  { symbol: 'TIRUMALCHM', name: 'Tirumalai Chemicals', sector: 'Chemicals', basePrice: 280, volatility: 0.30, drift: 0.10 },
  { symbol: 'AARTIIND', name: 'Aarti Industries', sector: 'Chemicals', basePrice: 680, volatility: 0.27, drift: 0.12 },
  { symbol: 'NAVINFLUOR', name: 'Navin Fluorine', sector: 'Chemicals', basePrice: 3480, volatility: 0.26, drift: 0.14 },
  { symbol: 'ALCHEM', name: 'Alkem Laboratories', sector: 'Chemicals', basePrice: 5480, volatility: 0.24, drift: 0.13 },
  { symbol: 'VINATIORGA', name: 'Vinati Organics', sector: 'Chemicals', basePrice: 1980, volatility: 0.25, drift: 0.12 },
  { symbol: 'FINEORG', name: 'Fine Organic Industries', sector: 'Chemicals', basePrice: 4880, volatility: 0.26, drift: 0.13 },

  // === Realty (additional) ===
  { symbol: 'ANANTRAJ', name: 'Anant Raj Limited', sector: 'Realty', basePrice: 95, volatility: 0.30, drift: 0.18 },
  { symbol: 'MAHINDRAEST', name: 'Mahindra Lifespaces', sector: 'Realty', basePrice: 480, volatility: 0.28, drift: 0.12 },
  { symbol: 'ARVIND', name: 'Arvind Limited', sector: 'Realty', basePrice: 285, volatility: 0.28, drift: 0.06 },
  { symbol: 'IBREALEST', name: 'Indiabulls Real Estate', sector: 'Realty', basePrice: 195, volatility: 0.30, drift: 0.08 },

  // === Aviation & Transport (additional) ===
  { symbol: 'SPICEJET', name: 'SpiceJet', sector: 'Consumer', basePrice: 65, volatility: 0.35, drift: 0.05 },
  { symbol: 'JETAIRWAYS', name: 'Jet Airways', sector: 'Consumer', basePrice: 65, volatility: 0.40, drift: -0.05 },
  { symbol: 'GLOBALVECT', name: 'Global Vectra', sector: 'Consumer', basePrice: 195, volatility: 0.32, drift: 0.10 },
  { symbol: 'CONCOR', name: 'Container Corp of India', sector: 'Infra', basePrice: 1080, volatility: 0.25, drift: 0.12 },
  { symbol: 'TCI', name: 'Transport Corp of India', sector: 'Infra', basePrice: 980, volatility: 0.26, drift: 0.15 },
  { symbol: 'BLUE DART', name: 'Blue Dart Express', sector: 'Consumer', basePrice: 980, volatility: 0.28, drift: 0.13, yahooSymbol: 'BLUEDART.NS' },
  { symbol: 'DELHIVERY', name: 'Delhivery Limited', sector: 'Consumer', basePrice: 380, volatility: 0.32, drift: 0.10 },

  // === Shipping & Ports (additional) ===
  { symbol: 'GE SHIPPING', name: 'Great Eastern Shipping', sector: 'Energy', basePrice: 980, volatility: 0.27, drift: 0.15, yahooSymbol: 'GESHIP.NS' },
  { symbol: 'SHIPCORP', name: 'Shipping Corporation of India', sector: 'Energy', basePrice: 195, volatility: 0.28, drift: 0.13 },
  { symbol: 'ABGSHIP', name: 'ABG Shipyard', sector: 'Energy', basePrice: 195, volatility: 0.32, drift: -0.02 },
  { symbol: 'BHARTI', name: 'Bharti Defence', sector: 'Energy', basePrice: 18, volatility: 0.35, drift: 0.05 },

  // === Textiles & Apparel (additional) ===
  { symbol: 'WELSIND', name: 'Welspun India', sector: 'Consumer', basePrice: 165, volatility: 0.28, drift: 0.13 },
  { symbol: 'KITEXGAR', name: 'Kitex Garments', sector: 'Consumer', basePrice: 245, volatility: 0.30, drift: 0.10 },
  { symbol: 'GOKALDAS', name: 'Gokaldas Exports', sector: 'Consumer', basePrice: 980, volatility: 0.28, drift: 0.15 },
  { symbol: 'FELIX', name: 'Felix Industries', sector: 'Consumer', basePrice: 95, volatility: 0.32, drift: 0.10 },
  { symbol: 'ARVINDFAB', name: 'Arvind Fashions', sector: 'Consumer', basePrice: 285, volatility: 0.30, drift: 0.15 },
  { symbol: 'PAGEIND', name: 'Page Industries', sector: 'Consumer', basePrice: 38800, volatility: 0.24, drift: 0.10 },
  { symbol: 'LOVABLE', name: 'Lovable Lingerie', sector: 'Consumer', basePrice: 245, volatility: 0.30, drift: 0.05 },
  { symbol: 'WELSILK', name: 'Welspun Investments', sector: 'Consumer', basePrice: 480, volatility: 0.28, drift: 0.10 },

  // === Engineering & Electricals (additional) ===
  { symbol: 'BAJAJHIND', name: 'Bajaj Hindusthan', sector: 'Consumer', basePrice: 18, volatility: 0.35, drift: 0.02 },
  { symbol: 'BAJAJELEC', name: 'Bajaj Electricals', sector: 'Consumer', basePrice: 1180, volatility: 0.27, drift: 0.10 },
  { symbol: 'BHEL-bk', name: 'BHEL', sector: 'Infra', basePrice: 245, volatility: 0.30, drift: 0.15 },
  { symbol: 'AARTIDRUGS', name: 'Aarti Pharmalabs', sector: 'Pharma', basePrice: 680, volatility: 0.26, drift: 0.13 },
  { symbol: 'CAMS', name: 'Computer Age Management', sector: 'IT', basePrice: 3480, volatility: 0.27, drift: 0.20 },
  { symbol: 'CESC', name: 'CESC Limited', sector: 'Power', basePrice: 130, volatility: 0.24, drift: 0.08 },
  { symbol: 'KALPATARA', name: 'Kalpataru Projects', sector: 'Infra', basePrice: 580, volatility: 0.26, drift: 0.15 },
  { symbol: 'KALYANKJIL', name: 'Kalyan Jewellers', sector: 'Consumer', basePrice: 380, volatility: 0.30, drift: 0.25 },
  { symbol: 'TBZ', name: 'Tribhovandas Bhimji', sector: 'Consumer', basePrice: 95, volatility: 0.30, drift: 0.08 },
  { symbol: 'PCJEWELLER', name: 'PC Jeweller', sector: 'Consumer', basePrice: 18, volatility: 0.35, drift: 0.02 },
  { symbol: 'RJEWELERS', name: 'Renaissance Jewellers', sector: 'Consumer', basePrice: 18, volatility: 0.32, drift: 0.05 },
  { symbol: 'SOLARA', name: 'Solara Active Pharma', sector: 'Pharma', basePrice: 980, volatility: 0.27, drift: 0.10 },
  { symbol: 'FREEMEXX', name: 'Future Retail', sector: 'Consumer', basePrice: 12, volatility: 0.40, drift: -0.10 },

  // === Paper, Glass, Packaging (additional) ===
  { symbol: 'JKPAPER', name: 'JK Paper Limited', sector: 'Consumer', basePrice: 380, volatility: 0.27, drift: 0.15 },
  { symbol: 'BILT', name: 'Ballarpur Industries', sector: 'Consumer', basePrice: 18, volatility: 0.35, drift: -0.05 },
  { symbol: 'TODAYPAPER', name: 'Today\'s Writing Products', sector: 'Consumer', basePrice: 95, volatility: 0.30, drift: 0.05 },
  { symbol: 'ESSELPACK', name: 'Essel Propack', sector: 'Consumer', basePrice: 245, volatility: 0.28, drift: 0.10 },
  { symbol: 'EPL', name: 'EPL Limited', sector: 'Consumer', basePrice: 195, volatility: 0.27, drift: 0.12 },
  { symbol: 'HSIL', name: 'Hindustan Sanitaryware', sector: 'Consumer', basePrice: 285, volatility: 0.27, drift: 0.08 },
  { symbol: 'BOROLTK', name: 'Borosil Limited', sector: 'Consumer', basePrice: 480, volatility: 0.27, drift: 0.13 },
  { symbol: 'KOTYARK', name: 'Kotyark Industries', sector: 'Consumer', basePrice: 95, volatility: 0.32, drift: 0.10 },
  { symbol: 'MOLDTKPAC', name: 'Mold-Tek Packaging', sector: 'Consumer', basePrice: 980, volatility: 0.28, drift: 0.15 },
  { symbol: 'MAGSONS', name: 'Mag Sons', sector: 'Consumer', basePrice: 65, volatility: 0.32, drift: 0.05 },

  // === Sugar & Agri-processing (additional) ===
  { symbol: 'BALRAMCHIN', name: 'Balrampur Chini Mills', sector: 'Consumer', basePrice: 480, volatility: 0.30, drift: 0.15 },
  { symbol: 'TRIVENI', name: 'Triveni Engineering', sector: 'Consumer', basePrice: 380, volatility: 0.30, drift: 0.18 },
  { symbol: 'DHAMPURSUG', name: 'Dhampur Sugar Mills', sector: 'Consumer', basePrice: 245, volatility: 0.30, drift: 0.13 },
  { symbol: 'EIDPARRY', name: 'EID Parry India', sector: 'Consumer', basePrice: 580, volatility: 0.28, drift: 0.13 },
  { symbol: 'BANNARI', name: 'Bannari Amman Sugars', sector: 'Consumer', basePrice: 1980, volatility: 0.27, drift: 0.10 },
  { symbol: 'SHREERENUKA', name: 'Shree Renuka Sugars', sector: 'Consumer', basePrice: 45, volatility: 0.35, drift: 0.10 },
  { symbol: 'DWARKESH', name: 'Dwarikesh Sugar', sector: 'Consumer', basePrice: 95, volatility: 0.32, drift: 0.13 },
  { symbol: 'UTTAMSUGAR', name: 'Uttam Sugar Mills', sector: 'Consumer', basePrice: 285, volatility: 0.30, drift: 0.15 },
  { symbol: 'MAWANASUG', name: 'Mawana Sugars', sector: 'Consumer', basePrice: 95, volatility: 0.32, drift: 0.08 },

  // === Tea & Coffee (additional) ===
  { symbol: 'TATAGLOBAL', name: 'Tata Consumer Products', sector: 'FMCG', basePrice: 1080, volatility: 0.22, drift: 0.10 },
  { symbol: 'HARRMALAYA', name: 'Harrisons Malayalam', sector: 'FMCG', basePrice: 195, volatility: 0.28, drift: 0.05 },
  { symbol: 'MCDOWELL', name: 'McDowell Holdings', sector: 'FMCG', basePrice: 95, volatility: 0.32, drift: 0.02 },
  { symbol: 'ASSOCETFA', name: 'Associated Coffee', sector: 'FMCG', basePrice: 95, volatility: 0.30, drift: 0.05 },
  { symbol: 'CCLPRODUCT', name: 'CCL Products India', sector: 'FMCG', basePrice: 580, volatility: 0.27, drift: 0.15 },
  { symbol: 'NESTLEIND', name: 'Nestle India', sector: 'FMCG', basePrice: 2480, volatility: 0.18, drift: 0.07 },

  // === Diversified / Holdings / Conglomerates (additional) ===
  { symbol: 'TATAINVEST', name: 'Tata Investment Corporation', sector: 'Financials', basePrice: 4800, volatility: 0.26, drift: 0.18 },
  { symbol: 'TRENTLTD', name: 'Trent Limited', sector: 'Consumer', basePrice: 6420, volatility: 0.28, drift: 0.32 },
  { symbol: 'TTKPRESTIG', name: 'TTK Prestige Limited', sector: 'Consumer', basePrice: 780, volatility: 0.27, drift: 0.08 },
  { symbol: 'TTKHLTH', name: 'TTK Healthcare', sector: 'Pharma', basePrice: 1480, volatility: 0.25, drift: 0.08 },
  { symbol: 'WABCO', name: 'Wabco India', sector: 'Auto', basePrice: 14800, volatility: 0.24, drift: 0.08 },
  { symbol: 'WHIRLPOOL', name: 'Whirlpool of India', sector: 'Consumer', basePrice: 2480, volatility: 0.27, drift: 0.10 },
  { symbol: 'VIDESH', name: 'Videsh Sanchar Nigam', sector: 'Telecom', basePrice: 195, volatility: 0.30, drift: 0.05 },
  { symbol: 'ZENSARTECH', name: 'Zensar Technologies', sector: 'IT', basePrice: 680, volatility: 0.27, drift: 0.15 },
  { symbol: 'ZUARIGLOB', name: 'Zuari Global Limited', sector: 'Consumer', basePrice: 195, volatility: 0.30, drift: 0.08 },
  { symbol: 'AREVAT&D', name: 'Areva T&D India', sector: 'Power', basePrice: 95, volatility: 0.32, drift: 0.05 },
  { symbol: 'ASTEC', name: 'Astec Lifesciences', sector: 'Pharma', basePrice: 1180, volatility: 0.28, drift: 0.12 },
  { symbol: 'AVENTIS', name: 'Aventis CropScience', sector: 'Chemicals', basePrice: 95, volatility: 0.32, drift: 0.05 },
  { symbol: 'BLUEBLENDS', name: 'Blue Blends India', sector: 'Consumer', basePrice: 18, volatility: 0.35, drift: 0.02 },
  { symbol: 'BOMDYEING', name: 'The Bombay Dyeing', sector: 'Consumer', basePrice: 195, volatility: 0.30, drift: 0.10 },
  { symbol: 'BOSCHLTD', name: 'Bosch Limited', sector: 'Auto', basePrice: 32400, volatility: 0.24, drift: 0.12 },
  { symbol: 'ESAFSFB', name: 'ESAF Small Finance Bank', sector: 'Banking', basePrice: 65, volatility: 0.30, drift: 0.10 },
  { symbol: 'EQUITASBNK', name: 'Equitas Bank', sector: 'Banking', basePrice: 95, volatility: 0.28, drift: 0.10 },
  { symbol: 'UJJIVANSFB', name: 'Ujjivan Small Finance Bank', sector: 'Banking', basePrice: 45, volatility: 0.30, drift: 0.08 },
  { symbol: 'SURYODAY', name: 'Suryoday Small Finance', sector: 'Banking', basePrice: 165, volatility: 0.30, drift: 0.10 },
  { symbol: 'FCSOFTWARE', name: 'FCS Software', sector: 'IT', basePrice: 12, volatility: 0.40, drift: 0.05 },
  { symbol: 'GPPL', name: 'Gujarat Pipavav Port', sector: 'Infra', basePrice: 195, volatility: 0.27, drift: 0.15 },
  { symbol: 'IRCON', name: 'IRCON International', sector: 'Infra', basePrice: 245, volatility: 0.28, drift: 0.15 },
  { symbol: 'RITES', name: 'RITES Limited', sector: 'Infra', basePrice: 380, volatility: 0.27, drift: 0.12 },
  { symbol: 'RVNL', name: 'Rail Vikas Nigam', sector: 'Infra', basePrice: 380, volatility: 0.30, drift: 0.30 },
  { symbol: 'IRFC', name: 'Indian Railway Finance', sector: 'Infra', basePrice: 145, volatility: 0.28, drift: 0.20 },
  { symbol: 'MAZDOCK', name: 'Mazagon Dock Shipbuilders', sector: 'Infra', basePrice: 4880, volatility: 0.30, drift: 0.35 },
  { symbol: 'CDSL', name: 'Central Depository Services', sector: 'IT', basePrice: 1850, volatility: 0.28, drift: 0.25 },
  { symbol: 'HCL-INSYS', name: 'HCL Infosystems', sector: 'IT', basePrice: 18, volatility: 0.35, drift: -0.05 },
  { symbol: 'REDINGTON', name: 'Redington India', sector: 'IT', basePrice: 245, volatility: 0.26, drift: 0.15 },
  { symbol: 'OLAELEC', name: 'Ola Electric', sector: 'Auto', basePrice: 95, volatility: 0.40, drift: 0.10 },
  { symbol: 'SWIGGY', name: 'Swiggy Limited', sector: 'Consumer', basePrice: 380, volatility: 0.38, drift: 0.10 },
  { symbol: 'HYUNDAI', name: 'Hyundai Motor India', sector: 'Auto', basePrice: 1880, volatility: 0.28, drift: 0.08 },
  { symbol: 'BSE', name: 'BSE Limited', sector: 'Financials', basePrice: 4880, volatility: 0.30, drift: 0.35 },
  { symbol: 'MCX', name: 'Multi Commodity Exchange', sector: 'Financials', basePrice: 4880, volatility: 0.28, drift: 0.20 },
  { symbol: 'ICISYSTEMS', name: 'ICICI Securities', sector: 'Financials', basePrice: 780, volatility: 0.27, drift: 0.18 },
  { symbol: 'NAUKRI', name: 'Info Edge India', sector: 'IT', basePrice: 7480, volatility: 0.27, drift: 0.18 },
  { symbol: 'POLICYBZR', name: 'PB Fintech (PolicyBazaar)', sector: 'Financials', basePrice: 1680, volatility: 0.32, drift: 0.25 },
  { symbol: 'PAYTM', name: 'One 97 Communications', sector: 'Financials', basePrice: 380, volatility: 0.40, drift: 0.10 },

  // === Healthcare & Hospitals (additional) ===
  { symbol: 'FORTIS', name: 'Fortis Healthcare', sector: 'Pharma', basePrice: 480, volatility: 0.27, drift: 0.15 },
  { symbol: 'MAXHEALTH', name: 'Max Healthcare', sector: 'Pharma', basePrice: 980, volatility: 0.26, drift: 0.18 },
  { symbol: 'GLOBALHOSP', name: 'Global Health (Medanta)', sector: 'Pharma', basePrice: 1280, volatility: 0.27, drift: 0.20 },
  { symbol: 'KIMS', name: 'Krishna Institute of Medical', sector: 'Pharma', basePrice: 1980, volatility: 0.28, drift: 0.22 },
  { symbol: 'RAINBOW', name: 'Rainbow Children\'s Medicare', sector: 'Pharma', basePrice: 1480, volatility: 0.28, drift: 0.18 },
  { symbol: 'AsterDM', name: 'Aster DM Healthcare', sector: 'Pharma', basePrice: 380, volatility: 0.27, drift: 0.12 },

  // === Gaming & Sports (additional) ===
  { symbol: 'NAZARA', name: 'Nazara Technologies', sector: 'Consumer', basePrice: 980, volatility: 0.35, drift: 0.20 },
  { symbol: 'ZENOTECH', name: 'Zen Technologies', sector: 'Consumer', basePrice: 980, volatility: 0.32, drift: 0.22 },

  // === Fintech & Payments (additional) ===
  { symbol: 'CDSL', name: 'Central Depository Services', sector: 'Financials', basePrice: 1850, volatility: 0.28, drift: 0.25 },
  { symbol: 'CAMS', name: 'Computer Age Management', sector: 'Financials', basePrice: 3480, volatility: 0.27, drift: 0.20 },

  // === Logistics & Warehousing (additional) ===
  { symbol: 'ALLCARGO', name: 'Allcargo Logistics', sector: 'Infra', basePrice: 95, volatility: 0.30, drift: 0.08 },
  { symbol: 'TCISUPPLY', name: 'TCI Supply Chain', sector: 'Infra', basePrice: 980, volatility: 0.27, drift: 0.15 },
  { symbol: 'BLACKBERRY', name: 'BlackBerry Technologies', sector: 'IT', basePrice: 480, volatility: 0.30, drift: 0.10 },

  // === Defense & Aerospace (additional) ===
  { symbol: 'BDL', name: 'Bharat Dynamics', sector: 'Infra', basePrice: 1280, volatility: 0.28, drift: 0.20 },
  { symbol: 'MIDHANI', name: 'Mishra Dhatu Nigam', sector: 'Metals', basePrice: 380, volatility: 0.28, drift: 0.10 },
  { symbol: 'ASTRAL', name: 'Astral Limited', sector: 'Consumer', basePrice: 2480, volatility: 0.26, drift: 0.18 },
  { symbol: 'SAPPHIRE', name: 'Sapphire Foods', sector: 'Consumer', basePrice: 1480, volatility: 0.30, drift: 0.15 },
  { symbol: 'DEVYANI', name: 'Devyani International', sector: 'Consumer', basePrice: 195, volatility: 0.30, drift: 0.13 },
  { symbol: 'JUBLFOOD', name: 'Jubilant FoodWorks', sector: 'Consumer', basePrice: 780, volatility: 0.27, drift: 0.13 },
  { symbol: 'RESTAURANT', name: 'Restaurant Brands Asia', sector: 'Consumer', basePrice: 95, volatility: 0.32, drift: 0.05 },

  // === Beverage & Alcohol (additional) ===
  { symbol: 'GLOBUSSPR', name: 'Globus Spirits', sector: 'FMCG', basePrice: 980, volatility: 0.30, drift: 0.18 },
  { symbol: 'GMOSPINIT', name: 'G M Breweries', sector: 'FMCG', basePrice: 195, volatility: 0.30, drift: 0.10 },
  { symbol: 'EMBIDLTD', name: 'Embi Industries', sector: 'FMCG', basePrice: 1180, volatility: 0.28, drift: 0.18 },
  { symbol: 'TLB', name: 'Tilaknagar Industries', sector: 'FMCG', basePrice: 285, volatility: 0.32, drift: 0.20 },

  // === Travel & Tourism (additional) ===
  { symbol: 'TRAVEL', name: 'Thomas Cook India', sector: 'Consumer', basePrice: 195, volatility: 0.30, drift: 0.15 },
  { symbol: 'INLEISURE', name: 'Indian Hotels', sector: 'Consumer', basePrice: 720, volatility: 0.26, drift: 0.22 },
  { symbol: 'EASEMYTRIP', name: 'Easy Trip Planners', sector: 'Consumer', basePrice: 18, volatility: 0.35, drift: 0.05 },
  { symbol: 'YATRA', name: 'Yatra Online', sector: 'Consumer', basePrice: 165, volatility: 0.32, drift: 0.10 },

  // === Education & Training (additional) ===
  { symbol: 'EDUCOMP', name: 'Educomp Solutions', sector: 'IT', basePrice: 5, volatility: 0.40, drift: -0.10 },
  { symbol: 'EVEREADY', name: 'Eveready Industries', sector: 'Consumer', basePrice: 480, volatility: 0.28, drift: 0.13 },
  { symbol: 'NIITLTD', name: 'NIIT Learning Systems', sector: 'IT', basePrice: 380, volatility: 0.27, drift: 0.12 },
  { symbol: 'CDETLL', name: 'Career Point', sector: 'Consumer', basePrice: 95, volatility: 0.32, drift: 0.08 },
  { symbol: 'ZENTEK', name: 'Zen Technologies', sector: 'IT', basePrice: 980, volatility: 0.32, drift: 0.22 },

  // === Renewables & Cleantech (additional) ===
  { symbol: 'O2POWER', name: 'O2 Power', sector: 'Power', basePrice: 95, volatility: 0.32, drift: 0.08 },
  { symbol: 'INTELLECT', name: 'Intellect Design Arena', sector: 'IT', basePrice: 980, volatility: 0.28, drift: 0.18 },
  { symbol: 'KPIGREEN', name: 'KPI Green Energy', sector: 'Power', basePrice: 980, volatility: 0.35, drift: 0.30 },
  { symbol: 'FRENEL', name: 'Freneltic Energy', sector: 'Power', basePrice: 480, volatility: 0.32, drift: 0.18 },
  { symbol: 'ZEEL', name: 'Zee Entertainment', sector: 'Media', basePrice: 145, volatility: 0.32, drift: 0.06 },

  // === Wine & Spirits (additional) ===
  { symbol: 'SOMDISTILL', name: 'Som Distilleries', sector: 'FMCG', basePrice: 95, volatility: 0.32, drift: 0.13 },
  { symbol: 'ASSOICAL', name: 'Associated Alcohols', sector: 'FMCG', basePrice: 285, volatility: 0.30, drift: 0.15 },
  { symbol: 'IFLAGS', name: 'Innovative Industries', sector: 'FMCG', basePrice: 95, volatility: 0.32, drift: 0.10 },

  // === Sports & Entertainment (additional) ===
  { symbol: 'PVR', name: 'PVR Limited', sector: 'Media', basePrice: 1480, volatility: 0.28, drift: 0.12 },
  { symbol: 'INOXLEISUR', name: 'INOX Leisure', sector: 'Media', basePrice: 580, volatility: 0.30, drift: 0.10 },
  { symbol: 'NETWORK18', name: 'Network18 Media', sector: 'Media', basePrice: 95, volatility: 0.30, drift: 0.10 },
  { symbol: 'SAREGAMA', name: 'Saregama India', sector: 'Media', basePrice: 480, volatility: 0.30, drift: 0.18 },

  // === Power Equipment (additional) ===
  { symbol: 'ABB', name: 'ABB Power Products', sector: 'Power', basePrice: 7420, volatility: 0.26, drift: 0.24 },
  { symbol: 'CGPOWER', name: 'CG Power & Industrial', sector: 'Power', basePrice: 780, volatility: 0.30, drift: 0.30 },
  { symbol: 'KFIONA', name: 'Kfin Technologies', sector: 'IT', basePrice: 850, volatility: 0.27, drift: 0.20 },
  { symbol: 'ELECTHERM', name: 'Electrotherm India', sector: 'Metals', basePrice: 195, volatility: 0.32, drift: 0.10 },
  { symbol: 'SCHNEIDER', name: 'Schneider Electric', sector: 'Power', basePrice: 380, volatility: 0.27, drift: 0.20 },
]

// Filter out any accidental duplicates (some symbols appeared twice in my list)
const seen = new Set<string>()
export const UNIQUE_ADDITIONAL: StockMeta[] = ADDITIONAL_STOCKS.filter((s) => {
  if (seen.has(s.symbol)) return false
  seen.add(s.symbol)
  return true
})
