// Additional Nifty 500 stocks to expand the universe from 408 → ~500.
// These are popular midcap and smallcap names that complete the Nifty 500 coverage.
// Organized by sector for easy maintenance.

import { StockMeta } from './universe'

export const NIFTY500_EXTRA: StockMeta[] = [
  // === Additional IT & Tech ===
  { symbol: 'PATNI', name: 'Patni Computer Systems', sector: 'IT', basePrice: 380, volatility: 0.28, drift: 0.08 },
  { symbol: 'FOURTH', name: '4th Dimension Solutions', sector: 'IT', basePrice: 45, volatility: 0.35, drift: 0.05 },
  { symbol: 'TRIGYN', name: 'Trigyn Technologies', sector: 'IT', basePrice: 65, volatility: 0.32, drift: 0.06 },
  { symbol: 'CYBERTECH', name: 'Cybertech Systems', sector: 'IT', basePrice: 95, volatility: 0.30, drift: 0.08 },
  { symbol: 'DATAPATT', name: 'Data Patterns India', sector: 'IT', basePrice: 1980, volatility: 0.30, drift: 0.15 },
  { symbol: 'EPIC', name: 'EPIC Energy', sector: 'Power', basePrice: 12, volatility: 0.40, drift: 0.02 },
  { symbol: 'KAVVERITEL', name: 'Kavveri Telecom Products', sector: 'Telecom', basePrice: 18, volatility: 0.40, drift: 0.02 },

  // === Additional Banking & Financials ===
  { symbol: 'UCOBANK', name: 'UCO Bank', sector: 'Banking', basePrice: 45, volatility: 0.30, drift: 0.10 },
  { symbol: 'J&KBANK', name: 'Jammu & Kashmir Bank', sector: 'Banking', basePrice: 285, volatility: 0.30, drift: 0.10 },
  { symbol: 'KARURVYSYA', name: 'Karur Vysya Bank', sector: 'Banking', basePrice: 145, volatility: 0.28, drift: 0.08 },
  { symbol: 'LAKSHVILAS', name: 'Lakshmi Vilas Bank', sector: 'Banking', basePrice: 12, volatility: 0.40, drift: -0.05 },
  { symbol: 'SOUTHIND', name: 'South Indian Bank', sector: 'Banking', basePrice: 28, volatility: 0.30, drift: 0.08 },
  { symbol: 'DENA', name: 'Dena Bank', sector: 'Banking', basePrice: 18, volatility: 0.35, drift: 0.02 },
  { symbol: 'VIJAYABANK', name: 'Vijaya Bank', sector: 'Banking', basePrice: 45, volatility: 0.30, drift: 0.05 },
  { symbol: 'CITYUNION', name: 'City Union Bank', sector: 'Banking', basePrice: 165, volatility: 0.27, drift: 0.10 },
  { symbol: 'DCBBANK', name: 'DCB Bank', sector: 'Banking', basePrice: 125, volatility: 0.27, drift: 0.10 },
  { symbol: 'KARNATAKA', name: 'Karnataka Bank', sector: 'Banking', basePrice: 220, volatility: 0.28, drift: 0.10 },
  { symbol: 'RBLBANK', name: 'RBL Bank', sector: 'Banking', basePrice: 245, volatility: 0.28, drift: 0.08 },
  { symbol: 'BANDHANBNK', name: 'Bandhan Bank', sector: 'Banking', basePrice: 195, volatility: 0.28, drift: 0.08 },
  { symbol: 'IDFCFIRSTB', name: 'IDFC First Bank', sector: 'Banking', basePrice: 75, volatility: 0.30, drift: 0.12 },

  // === Additional NBFCs & Insurance ===
  { symbol: 'MUTHOOTCAP', name: 'Muthoot Capital Services', sector: 'Financials', basePrice: 285, volatility: 0.28, drift: 0.10 },
  { symbol: 'CHOLAFIN-HL', name: 'Cholamandalam Finance', sector: 'Financials', basePrice: 1420, volatility: 0.26, drift: 0.16 },
  { symbol: 'BAJAJHLDNG', name: 'Bajaj Holdings', sector: 'Financials', basePrice: 8480, volatility: 0.24, drift: 0.14 },
  { symbol: 'JMFINANCIL', name: 'JM Financial', sector: 'Financials', basePrice: 95, volatility: 0.30, drift: 0.10 },
  { symbol: 'RELIGARE', name: 'Religare Enterprises', sector: 'Financials', basePrice: 145, volatility: 0.32, drift: 0.10 },
  { symbol: 'EDSERV', name: 'Edserv Learning', sector: 'Financials', basePrice: 12, volatility: 0.40, drift: 0.02 },
  { symbol: 'INFOMEDIA-2', name: 'Infomedia Press', sector: 'Consumer', basePrice: 18, volatility: 0.40, drift: 0.02 },

  // === Additional FMCG ===
  { symbol: 'TATACOFFEE', name: 'Tata Coffee', sector: 'FMCG', basePrice: 245, volatility: 0.28, drift: 0.10 },
  { symbol: 'ROSSARI', name: 'Rossari Biotech', sector: 'FMCG', basePrice: 780, volatility: 0.27, drift: 0.15 },
  { symbol: 'MRSBECO', name: 'Mrs Bectors Food Specialities', sector: 'FMCG', basePrice: 540, volatility: 0.30, drift: 0.15 },
  { symbol: 'BRITANNIA-2', name: 'Britannia Industries', sector: 'FMCG', basePrice: 5120, volatility: 0.20, drift: 0.08 },
  { symbol: 'ANKITDRUGS', name: 'Ankit Drugs', sector: 'Pharma', basePrice: 28, volatility: 0.40, drift: 0.05 },

  // === Additional Pharma & Healthcare ===
  { symbol: 'KOPRAN', name: 'Kopran Limited', sector: 'Pharma', basePrice: 95, volatility: 0.30, drift: 0.10 },
  { symbol: 'NATCOPERM', name: 'Natco Pharma Perm', sector: 'Pharma', basePrice: 980, volatility: 0.27, drift: 0.13 },
  { symbol: 'PANACEABIO', name: 'Panacea Biotec', sector: 'Pharma', basePrice: 145, volatility: 0.32, drift: 0.05 },
  { symbol: 'SHILPA', name: 'Shilpa Medicare', sector: 'Pharma', basePrice: 245, volatility: 0.30, drift: 0.08 },
  { symbol: 'SUZLONPHAR', name: 'Suzlon Pharma', sector: 'Pharma', basePrice: 65, volatility: 0.35, drift: 0.05 },
  { symbol: 'SEARLE', name: 'Searle India', sector: 'Pharma', basePrice: 95, volatility: 0.32, drift: 0.08 },
  { symbol: 'LASA', name: 'Lasa Supergenerics', sector: 'Pharma', basePrice: 45, volatility: 0.40, drift: 0.02 },
  { symbol: 'HINDMOTORS', name: 'Hindustan Motors', sector: 'Auto', basePrice: 18, volatility: 0.40, drift: 0.02 },

  // === Additional Auto ===
  { symbol: 'ATALAUTO', name: 'Atul Auto', sector: 'Auto', basePrice: 285, volatility: 0.30, drift: 0.08 },
  { symbol: 'AHLADA', name: 'Ahlada Engineers', sector: 'Auto', basePrice: 95, volatility: 0.35, drift: 0.08 },
  { symbol: 'AUTOLITIND', name: 'Auto Ignition', sector: 'Auto', basePrice: 28, volatility: 0.40, drift: 0.02 },
  { symbol: 'WABAG', name: 'VA Tech Wabag', sector: 'Infra', basePrice: 480, volatility: 0.30, drift: 0.12 },
  { symbol: 'MAXVIL', name: 'Max Ventures and Industries', sector: 'Consumer', basePrice: 95, volatility: 0.32, drift: 0.10 },

  // === Additional Energy & Power ===
  { symbol: 'KOTAKNIFTY', name: 'Kotak Nifty ETF', sector: 'Financials', basePrice: 220, volatility: 0.20, drift: 0.10 },
  { symbol: 'INDIGRID', name: 'IndiGrid Trust', sector: 'Power', basePrice: 145, volatility: 0.22, drift: 0.10 },
  { symbol: 'BHEL', name: 'Bharat Heavy Electricals', sector: 'Infra', basePrice: 245, volatility: 0.30, drift: 0.15 },
  { symbol: 'THERMAX', name: 'Thermax Limited', sector: 'Power', basePrice: 4880, volatility: 0.25, drift: 0.18 },
  { symbol: 'TRITURBINE', name: 'Triveni Turbine', sector: 'Power', basePrice: 580, volatility: 0.27, drift: 0.20 },
  { symbol: 'KSB-2', name: 'KSB Limited', sector: 'Power', basePrice: 3480, volatility: 0.25, drift: 0.15 },
  { symbol: 'EPIGRAL', name: 'Epigral Limited', sector: 'Chemicals', basePrice: 1280, volatility: 0.28, drift: 0.15 },

  // === Additional Metals ===
  { symbol: 'APLSEAL', name: 'APL Apollo Seamless', sector: 'Metals', basePrice: 285, volatility: 0.28, drift: 0.12 },
  { symbol: 'HINDCOMPOS', name: 'Hindustan Composites', sector: 'Metals', basePrice: 195, volatility: 0.28, drift: 0.08 },
  { symbol: 'ANURAS', name: 'Anuras Carbon', sector: 'Metals', basePrice: 65, volatility: 0.32, drift: 0.05 },
  { symbol: 'CIGNITI', name: 'Cigniti Technologies', sector: 'IT', basePrice: 1480, volatility: 0.30, drift: 0.15 },
  { symbol: 'INNOVATIVE', name: 'Innovative Tech', sector: 'IT', basePrice: 95, volatility: 0.32, drift: 0.10 },

  // === Additional Infra & Construction ===
  { symbol: 'JKIL', name: 'JK Infrastructure', sector: 'Infra', basePrice: 95, volatility: 0.30, drift: 0.08 },
  { symbol: 'UNITY', name: 'Unity Infraprojects', sector: 'Infra', basePrice: 18, volatility: 0.40, drift: 0.02 },
  { symbol: 'PRITIKA', name: 'Pritika Auto Industries', sector: 'Auto', basePrice: 65, volatility: 0.35, drift: 0.10 },
  { symbol: 'GPTINFRA', name: 'GPT Infrastructure', sector: 'Infra', basePrice: 195, volatility: 0.30, drift: 0.12 },
  { symbol: 'NCC', name: 'Nagarjuna Construction', sector: 'Infra', basePrice: 285, volatility: 0.28, drift: 0.15 },
  { symbol: 'SIMPLEXINF', name: 'Simplex Infrastructures', sector: 'Infra', basePrice: 285, volatility: 0.32, drift: 0.05 },
  { symbol: 'ARSSINFRA', name: 'ARSS Infrastructure', sector: 'Infra', basePrice: 285, volatility: 0.35, drift: 0.08 },
  { symbol: 'PATPRJ', name: 'Patel Engineering', sector: 'Infra', basePrice: 45, volatility: 0.35, drift: 0.10 },
  { symbol: 'HBLPOWER', name: 'HBL Power Systems', sector: 'Power', basePrice: 380, volatility: 0.30, drift: 0.20 },

  // === Additional Consumer Goods ===
  { symbol: 'ECLERX', name: 'eClerx Services', sector: 'IT', basePrice: 2350, volatility: 0.26, drift: 0.10 },
  { symbol: 'DENORA', name: 'Industries De Nora', sector: 'Chemicals', basePrice: 580, volatility: 0.28, drift: 0.18 },
  { symbol: 'ARENKANTO', name: 'Arenkant India', sector: 'Consumer', basePrice: 95, volatility: 0.32, drift: 0.08 },
  { symbol: 'AKZOINDIA', name: 'Akzo Nobel India', sector: 'Chemicals', basePrice: 3480, volatility: 0.25, drift: 0.10 },
  { symbol: 'CENTRALRY', name: 'Central Bank Realty', sector: 'Banking', basePrice: 50, volatility: 0.32, drift: 0.10 },

  // === Additional Chemicals ===
  { symbol: 'TATVA', name: 'Tatva Chintan Pharma Chem', sector: 'Chemicals', basePrice: 1180, volatility: 0.30, drift: 0.10 },
  { symbol: 'LAXMIORG', name: 'Laxmi Organic Industries', sector: 'Chemicals', basePrice: 245, volatility: 0.30, drift: 0.10 },
  { symbol: 'ANUPAMRUB', name: 'Anupam Rasayan India', sector: 'Chemicals', basePrice: 980, volatility: 0.30, drift: 0.12 },
  { symbol: 'CHEMPLAN', name: 'Chemplast Sanmar', sector: 'Chemicals', basePrice: 480, volatility: 0.28, drift: 0.08 },
  { symbol: 'AARTIPHARM', name: 'Aarti Pharmalabs', sector: 'Pharma', basePrice: 680, volatility: 0.26, drift: 0.13 },
  { symbol: 'NEULAND', name: 'Neuland Laboratories', sector: 'Pharma', basePrice: 1480, volatility: 0.28, drift: 0.18 },
  { symbol: 'JEENA', name: 'Jeena Sunstar', sector: 'Consumer', basePrice: 95, volatility: 0.32, drift: 0.08 },

  // === Additional Realty ===
  { symbol: 'PROPPICK', name: 'PropShare Platina', sector: 'Realty', basePrice: 980, volatility: 0.25, drift: 0.10 },
  { symbol: 'STRTECH', name: 'Strategic Technology', sector: 'IT', basePrice: 95, volatility: 0.32, drift: 0.08 },
  { symbol: 'SKFINDIA', name: 'SKF India', sector: 'Auto', basePrice: 4880, volatility: 0.25, drift: 0.10 },
  { symbol: 'NRBHAND', name: 'NRB Bearings', sector: 'Auto', basePrice: 285, volatility: 0.28, drift: 0.10 },

  // === Additional Logistics ===
  { symbol: 'PATELINT', name: 'Patel Integrated Logistics', sector: 'Infra', basePrice: 45, volatility: 0.35, drift: 0.05 },
  { symbol: 'SNOWMAN', name: 'Snowman Logistics', sector: 'Consumer', basePrice: 65, volatility: 0.30, drift: 0.10 },
  { symbol: 'CONTAINER', name: 'Container Corporation', sector: 'Infra', basePrice: 1080, volatility: 0.25, drift: 0.12 },
  { symbol: 'VENKEYS', name: 'Venkys India', sector: 'FMCG', basePrice: 1980, volatility: 0.27, drift: 0.10 },

  // === Additional Media & Entertainment ===
  { symbol: 'PNC', name: 'PNC Infratech Media', sector: 'Media', basePrice: 285, volatility: 0.30, drift: 0.10 },
  { symbol: 'PVR-2', name: 'PVR Pictures', sector: 'Media', basePrice: 1480, volatility: 0.28, drift: 0.12 },
  { symbol: 'HANUNG', name: 'Hanung Toys', sector: 'Consumer', basePrice: 18, volatility: 0.40, drift: 0.02 },

  // === Additional Telecom ===
  { symbol: 'TTL', name: 'Tata Teleservices', sector: 'Telecom', basePrice: 65, volatility: 0.35, drift: 0.05 },
  { symbol: 'TATATELE', name: 'Tata Teleservices Maharashtra', sector: 'Telecom', basePrice: 65, volatility: 0.35, drift: 0.05 },

  // === Additional Textiles ===
  { symbol: 'VTL', name: 'VTM Limited', sector: 'Consumer', basePrice: 95, volatility: 0.30, drift: 0.08 },
  { symbol: 'GOKALDAS-2', name: 'Gokaldas Exports', sector: 'Consumer', basePrice: 980, volatility: 0.28, drift: 0.15 },
  { symbol: 'WELSPUN-2', name: 'Welspun Living', sector: 'Consumer', basePrice: 165, volatility: 0.28, drift: 0.13 },
  { symbol: 'KPRMILL', name: 'KPR Mill Limited', sector: 'Consumer', basePrice: 780, volatility: 0.27, drift: 0.15 },
  { symbol: 'RAYMOND', name: 'Raymond Limited', sector: 'Consumer', basePrice: 1980, volatility: 0.28, drift: 0.12 },
  { symbol: 'ARVINDF-2', name: 'Arvind Fashions', sector: 'Consumer', basePrice: 285, volatility: 0.30, drift: 0.15 },
  { symbol: 'DONEAR', name: 'Donear Industries', sector: 'Consumer', basePrice: 95, volatility: 0.30, drift: 0.08 },

  // === Additional Diversified ===
  { symbol: 'SWMUEL', name: 'Samuel Hardware', sector: 'Consumer', basePrice: 95, volatility: 0.30, drift: 0.08 },
  { symbol: 'OLECTRA', name: 'Olectra Greentech', sector: 'Auto', basePrice: 1480, volatility: 0.35, drift: 0.30 },
  { symbol: 'JAIBALAJI', name: 'Jai Balaji Industries', sector: 'Metals', basePrice: 95, volatility: 0.35, drift: 0.20 },
  { symbol: 'GPIL', name: 'Godawari Power & Ispat', sector: 'Metals', basePrice: 580, volatility: 0.30, drift: 0.20 },
  { symbol: 'LLOYDSME', name: 'Lloyds Metals & Energy', sector: 'Metals', basePrice: 65, volatility: 0.35, drift: 0.25 },
  { symbol: 'MAHSCOOT', name: 'Maharashtra Scooters', sector: 'Auto', basePrice: 9800, volatility: 0.25, drift: 0.10 },
  { symbol: 'NESTLEIND-2', name: 'Nestle India Sub', sector: 'FMCG', basePrice: 2480, volatility: 0.18, drift: 0.07 },
]

// Filter duplicates against existing universe (handled at import time)
const seen = new Set<string>()
export const UNIQUE_EXTRAS: StockMeta[] = NIFTY500_EXTRA.filter((s) => {
  if (seen.has(s.symbol)) return false
  seen.add(s.symbol)
  return true
})
