// Additional Nifty 500 stocks to expand the universe from 408 → ~500.
// These are popular midcap and smallcap names that complete the Nifty 500 coverage.
// Organized by sector for easy maintenance.

import { StockMeta } from './universe'

export const NIFTY500_EXTRA: StockMeta[] = [
// === Additional IT & Tech ===
  { symbol: 'TRIGYN', name: 'Trigyn Technologies', sector: 'IT', basePrice: 65, volatility: 0.32, drift: 0.06 },
  { symbol: 'CYBERTECH', name: 'Cybertech Systems', sector: 'IT', basePrice: 95, volatility: 0.30, drift: 0.08 },
  { symbol: 'DATAPATTNS', name: 'Data Patterns India', sector: 'IT', basePrice: 1980, volatility: 0.30, drift: 0.15 },

  // === Additional Banking & Financials ===
  { symbol: 'J&KBANK', name: 'Jammu & Kashmir Bank', sector: 'Banking', basePrice: 285, volatility: 0.30, drift: 0.10 },
  { symbol: 'KARURVYSYA', name: 'Karur Vysya Bank', sector: 'Banking', basePrice: 145, volatility: 0.28, drift: 0.08 },
  { symbol: 'SOUTHBANK', name: 'South Indian Bank', sector: 'Banking', basePrice: 28, volatility: 0.30, drift: 0.08 },
  { symbol: 'CUB', name: 'City Union Bank', sector: 'Banking', basePrice: 165, volatility: 0.27, drift: 0.10 },
  { symbol: 'DCBBANK', name: 'DCB Bank', sector: 'Banking', basePrice: 125, volatility: 0.27, drift: 0.10 },
  { symbol: 'KARNATAKA', name: 'Karnataka Bank', sector: 'Banking', basePrice: 220, volatility: 0.28, drift: 0.10, yahooSymbol: 'KTKBANK.NS' },
  { symbol: 'RBLBANK', name: 'RBL Bank', sector: 'Banking', basePrice: 245, volatility: 0.28, drift: 0.08 },
  { symbol: 'BANDHANBNK', name: 'Bandhan Bank', sector: 'Banking', basePrice: 195, volatility: 0.28, drift: 0.08 },
  { symbol: 'IDFCFIRSTB', name: 'IDFC First Bank', sector: 'Banking', basePrice: 75, volatility: 0.30, drift: 0.12 },

  // === Additional NBFCs & Insurance ===
  { symbol: 'MUTHOOTCAP', name: 'Muthoot Capital Services', sector: 'Financials', basePrice: 285, volatility: 0.28, drift: 0.10 },
  { symbol: 'CHOLAFIN', name: 'Cholamandalam Finance', sector: 'Financials', basePrice: 1420, volatility: 0.26, drift: 0.16 },
  { symbol: 'BAJAJHLDNG', name: 'Bajaj Holdings', sector: 'Financials', basePrice: 8480, volatility: 0.24, drift: 0.14 },
  { symbol: 'JMFINANCIL', name: 'JM Financial', sector: 'Financials', basePrice: 95, volatility: 0.30, drift: 0.10 },
  { symbol: 'RELIGARE', name: 'Religare Enterprises', sector: 'Financials', basePrice: 145, volatility: 0.32, drift: 0.10 },

  // === Additional FMCG ===
  ,
  { symbol: 'ROSSARI', name: 'Rossari Biotech', sector: 'FMCG', basePrice: 780, volatility: 0.27, drift: 0.15 },
  { symbol: 'BECTORFOOD', name: 'Mrs Bectors Food Specialities', sector: 'FMCG', basePrice: 540, volatility: 0.30, drift: 0.15 },
  { symbol: 'BRITANNIA', name: 'Britannia Industries', sector: 'FMCG', basePrice: 5120, volatility: 0.20, drift: 0.08 },

  // === Additional Pharma & Healthcare ===
  { symbol: 'KOPRAN', name: 'Kopran Limited', sector: 'Pharma', basePrice: 95, volatility: 0.30, drift: 0.10 },
  { symbol: 'PANACEABIO', name: 'Panacea Biotec', sector: 'Pharma', basePrice: 145, volatility: 0.32, drift: 0.05 },
  { symbol: 'SHILPA', name: 'Shilpa Medicare', sector: 'Pharma', basePrice: 245, volatility: 0.30, drift: 0.08, yahooSymbol: 'SHILPAMED.NS' },
  { symbol: 'LASA', name: 'Lasa Supergenerics', sector: 'Pharma', basePrice: 45, volatility: 0.40, drift: 0.02 },
  { symbol: 'HINDMOTORS', name: 'Hindustan Motors', sector: 'Auto', basePrice: 18, volatility: 0.40, drift: 0.02, yahooSymbol: '500500.BO' },

  // === Additional Auto ===
  { symbol: 'ATALAUTO', name: 'Atul Auto', sector: 'Auto', basePrice: 285, volatility: 0.30, drift: 0.08, yahooSymbol: 'ATULAUTO.NS' },
  { symbol: 'AHLADA', name: 'Ahlada Engineers', sector: 'Auto', basePrice: 95, volatility: 0.35, drift: 0.08 },
  { symbol: 'WABAG', name: 'VA Tech Wabag', sector: 'Infra', basePrice: 480, volatility: 0.30, drift: 0.12 },
  { symbol: 'MAXESTATES', name: 'Max Ventures and Industries', sector: 'Consumer', basePrice: 95, volatility: 0.32, drift: 0.10 },

  // === Additional Energy & Power ===
  { symbol: 'NIFTY1', name: 'Kotak Nifty ETF', sector: 'Financials', basePrice: 220, volatility: 0.20, drift: 0.10 },
  { symbol: 'INDIGRID', name: 'IndiGrid Trust', sector: 'Power', basePrice: 145, volatility: 0.22, drift: 0.10 },
  { symbol: 'BHEL', name: 'Bharat Heavy Electricals', sector: 'Infra', basePrice: 245, volatility: 0.30, drift: 0.15 },
  { symbol: 'THERMAX', name: 'Thermax Limited', sector: 'Power', basePrice: 4880, volatility: 0.25, drift: 0.18 },
  { symbol: 'TRITURBINE', name: 'Triveni Turbine', sector: 'Power', basePrice: 580, volatility: 0.27, drift: 0.20 },
  { symbol: 'EPIGRAL', name: 'Epigral Limited', sector: 'Chemicals', basePrice: 1280, volatility: 0.28, drift: 0.15 },

  // === Additional Metals ===
  ,
  { symbol: 'HINDCOMPOS', name: 'Hindustan Composites', sector: 'Metals', basePrice: 195, volatility: 0.28, drift: 0.08 },
  { symbol: 'ANURAS', name: 'Anuras Carbon', sector: 'Metals', basePrice: 65, volatility: 0.32, drift: 0.05 },
  { symbol: 'CIGNITI', name: 'Cigniti Technologies', sector: 'IT', basePrice: 1480, volatility: 0.30, drift: 0.15, yahooSymbol: '534758.BO' },
  { symbol: 'INNOVATIVE', name: 'Innovative Tech', sector: 'IT', basePrice: 95, volatility: 0.32, drift: 0.10 },

  // === Additional Infra & Construction ===
  { symbol: 'JKIL', name: 'JK Infrastructure', sector: 'Infra', basePrice: 95, volatility: 0.30, drift: 0.08 },
  { symbol: 'PRITIKA', name: 'Pritika Auto Industries', sector: 'Auto', basePrice: 65, volatility: 0.35, drift: 0.10 },
  { symbol: 'GPTINFRA', name: 'GPT Infrastructure', sector: 'Infra', basePrice: 195, volatility: 0.30, drift: 0.12 },
  { symbol: 'NCC', name: 'Nagarjuna Construction', sector: 'Infra', basePrice: 285, volatility: 0.28, drift: 0.15 },
  { symbol: 'SIMPLEXINF', name: 'Simplex Infrastructures', sector: 'Infra', basePrice: 285, volatility: 0.32, drift: 0.05 },
  { symbol: 'ARSSINFRA', name: 'ARSS Infrastructure', sector: 'Infra', basePrice: 285, volatility: 0.35, drift: 0.08 },
  { symbol: 'PATPRJ', name: 'Patel Engineering', sector: 'Infra', basePrice: 45, volatility: 0.35, drift: 0.10, yahooSymbol: 'PATELENG.NS' },
  { symbol: 'HBLENGINE', name: 'HBL Power Systems', sector: 'Power', basePrice: 380, volatility: 0.30, drift: 0.20, yahooSymbol: 'HBLENGINE.NS' },

  // === Additional Consumer Goods ===
  { symbol: 'ECLERX', name: 'eClerx Services', sector: 'IT', basePrice: 2350, volatility: 0.26, drift: 0.10 },
  { symbol: 'DENORA', name: 'Industries De Nora', sector: 'Chemicals', basePrice: 580, volatility: 0.28, drift: 0.18 },
  { symbol: 'JSWDULUX', name: 'Akzo Nobel India', sector: 'Chemicals', basePrice: 3480, volatility: 0.25, drift: 0.10, yahooSymbol: 'JSWDULUX.NS' },

  // === Additional Chemicals ===
  { symbol: 'TATVA', name: 'Tatva Chintan Pharma Chem', sector: 'Chemicals', basePrice: 1180, volatility: 0.30, drift: 0.10 },
  { symbol: 'LAXMIORG', name: 'Laxmi Organic Industries', sector: 'Chemicals', basePrice: 245, volatility: 0.30, drift: 0.10, yahooSymbol: 'LXCHEM.NS' },
  { symbol: 'ANUPAM', name: 'Anupam Rasayan India', sector: 'Chemicals', basePrice: 980, volatility: 0.30, drift: 0.12, yahooSymbol: 'ANURAS.NS' },
  { symbol: 'CHEMPLAN', name: 'Chemplast Sanmar', sector: 'Chemicals', basePrice: 480, volatility: 0.28, drift: 0.08, yahooSymbol: 'CHEMPLASTS.NS' },
  { symbol: 'AARTIPHARM', name: 'Aarti Pharmalabs', sector: 'Pharma', basePrice: 680, volatility: 0.26, drift: 0.13 },
  { symbol: 'NEULAND', name: 'Neuland Laboratories', sector: 'Pharma', basePrice: 1480, volatility: 0.28, drift: 0.18, yahooSymbol: 'NEULANDLAB.NS' },

  // === Additional Realty ===
  { symbol: 'STLTECH', name: 'Strategic Technology', sector: 'IT', basePrice: 95, volatility: 0.32, drift: 0.08 },
  { symbol: 'SKFINDIA', name: 'SKF India', sector: 'Auto', basePrice: 4880, volatility: 0.25, drift: 0.10 },
  { symbol: 'NRBHAND', name: 'NRB Bearings', sector: 'Auto', basePrice: 285, volatility: 0.28, drift: 0.10, yahooSymbol: 'NRBBEARING.NS' },

  // === Additional Logistics ===
  { symbol: 'PATINTLOG', name: 'Patel Integrated Logistics', sector: 'Infra', basePrice: 45, volatility: 0.35, drift: 0.05 },
  { symbol: 'SNOWMAN', name: 'Snowman Logistics', sector: 'Consumer', basePrice: 65, volatility: 0.30, drift: 0.10 },
  { symbol: 'CONTAINER', name: 'Container Corporation', sector: 'Infra', basePrice: 1080, volatility: 0.25, drift: 0.12, yahooSymbol: 'CONCOR.NS' },
  { symbol: 'VENKEYS', name: 'Venkys India', sector: 'FMCG', basePrice: 1980, volatility: 0.27, drift: 0.10 },

  // === Additional Media & Entertainment ===
  { symbol: 'PNC', name: 'PNC Infratech Media', sector: 'Media', basePrice: 285, volatility: 0.30, drift: 0.10 },

  // === Additional Telecom ===
  { symbol: 'TTL', name: 'Tata Teleservices', sector: 'Telecom', basePrice: 65, volatility: 0.35, drift: 0.05 },
  { symbol: 'TATATELE', name: 'Tata Teleservices Maharashtra', sector: 'Telecom', basePrice: 65, volatility: 0.35, drift: 0.05, yahooSymbol: 'TTML.NS' },

  // === Additional Textiles ===
  { symbol: 'VTL', name: 'VTM Limited', sector: 'Consumer', basePrice: 95, volatility: 0.30, drift: 0.08 },
  { symbol: 'GOKALDAS-2', name: 'Gokaldas Exports', sector: 'Consumer', basePrice: 980, volatility: 0.28, drift: 0.15, yahooSymbol: 'GOKEX.NS' },
  { symbol: 'WELSPUNLIV', name: 'Welspun Living', sector: 'Consumer', basePrice: 165, volatility: 0.28, drift: 0.13 },
  { symbol: 'KPRMILL', name: 'KPR Mill Limited', sector: 'Consumer', basePrice: 780, volatility: 0.27, drift: 0.15 },
  { symbol: 'RAYMOND', name: 'Raymond Limited', sector: 'Consumer', basePrice: 1980, volatility: 0.28, drift: 0.12 },
  { symbol: 'ARVINDF-2', name: 'Arvind Fashions', sector: 'Consumer', basePrice: 285, volatility: 0.30, drift: 0.15, yahooSymbol: 'ARVINDFASN.NS' },
  { symbol: 'DONEAR', name: 'Donear Industries', sector: 'Consumer', basePrice: 95, volatility: 0.30, drift: 0.08 },

  // === Additional Diversified ===
  { symbol: 'OLECTRA', name: 'Olectra Greentech', sector: 'Auto', basePrice: 1480, volatility: 0.35, drift: 0.30 },
  { symbol: 'JAIBALAJI', name: 'Jai Balaji Industries', sector: 'Metals', basePrice: 95, volatility: 0.35, drift: 0.20 },
  { symbol: 'GPIL', name: 'Godawari Power & Ispat', sector: 'Metals', basePrice: 580, volatility: 0.30, drift: 0.20 },
  { symbol: 'LLOYDSME', name: 'Lloyds Metals & Energy', sector: 'Metals', basePrice: 65, volatility: 0.35, drift: 0.25 },
  { symbol: 'MAHSCOOT', name: 'Maharashtra Scooters', sector: 'Auto', basePrice: 9800, volatility: 0.25, drift: 0.10, yahooSymbol: 'MAHSCOOTER.NS' },
  { symbol: 'NESTLEIND', name: 'Nestle India Sub', sector: 'FMCG', basePrice: 2480, volatility: 0.18, drift: 0.07 },
  { symbol: '3MINDIA', name: '3M India', sector: 'Consumer', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'AIAENG', name: 'AIA Engineering', sector: 'Consumer', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'AAVAS', name: 'Aavas Financiers', sector: 'Financials', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'ABCAPITAL', name: 'Aditya Birla Capital', sector: 'Financials', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'ABFRL', name: 'Aditya Birla Fashion and Retail', sector: 'Consumer', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'ADVENZYMES', name: 'Advanced Enzyme Tech', sector: 'Consumer', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'AJANTPHARM', name: 'Ajanta Pharmaceuticals', sector: 'Pharma', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'APLLTD', name: 'Alembic Pharmaceuticals', sector: 'Pharma', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'ALKEM', name: 'Alkem Laboratories', sector: 'Pharma', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'ASHOKA', name: 'Ashoka Buildcon', sector: 'Infra', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'ASTRAZEN', name: 'AstraZenca Pharma India', sector: 'Pharma', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'ATUL', name: 'Atul', sector: 'Chemicals', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'BASF', name: 'BASF India', sector: 'Chemicals', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'BEML', name: 'BEML', sector: 'Consumer', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'BAJAJCON', name: 'Bajaj Consumer Care', sector: 'Consumer', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'BAJAJFINSV', name: 'Bajaj Finserv', sector: 'Financials', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'BALMLAWRIE', name: 'Balmer Lawrie & Co.', sector: 'Consumer', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'BANKINDIA', name: 'Bank of India', sector: 'Financials', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'BATAINDIA', name: 'Bata India', sector: 'Consumer', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'BHARATFORG', name: 'Bharat Forge', sector: 'Consumer', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'BIRLACORPN', name: 'Birla Corporation', sector: 'Infra', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'BLISSGVS', name: 'Bliss GVS Pharma', sector: 'Pharma', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'BLUEDART', name: 'Blue Dart Express', sector: 'Consumer', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'BLUESTARCO', name: 'Blue Star', sector: 'Consumer', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'BBTC', name: 'Bombay Burmah Trading Corporation', sector: 'Consumer', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'CARERATING', name: 'CARE Ratings', sector: 'Financials', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'CCL', name: 'CCL Products (I)', sector: 'Consumer', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'CRISIL', name: 'CRISIL', sector: 'Financials', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'CANFINHOME', name: 'Can Fin Homes', sector: 'Financials', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'CAPLIPOINT', name: 'Caplin Point Laboratories', sector: 'Pharma', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'CARBORUNIV', name: 'Carborundum Universal', sector: 'Consumer', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'CASTROLIND', name: 'Castrol India', sector: 'Energy', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'CENTURYPLY', name: 'Century Plyboards (India)', sector: 'Consumer', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'CERA', name: 'Cera Sanitaryware', sector: 'Infra', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'CHENNPETRO', name: 'Chennai Petroleum Corporation', sector: 'Energy', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'CHOLAHLDNG', name: 'Cholamandalam Financial Holdings', sector: 'Financials', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'COCHINSHIP', name: 'Cochin Shipyard', sector: 'Consumer', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'COFFEEDAY', name: 'Coffee Day Enterprises', sector: 'Consumer', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'CUMMINSIND', name: 'Cummins India', sector: 'Consumer', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'CYIENT', name: 'Cyient', sector: 'IT', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'DBCORP', name: 'D.B.Corp', sector: 'Media', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'DCMSHRIRAM', name: 'DCM Shriram', sector: 'Consumer', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'DEEPAKNTR', name: 'Deepak Nitrite', sector: 'Chemicals', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'DELTACORP', name: 'Delta Corp', sector: 'Consumer', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'DBL', name: 'Dilip Buildcon', sector: 'Infra', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'DISHTV', name: 'Dish TV India', sector: 'Media', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'DCAL', name: 'Dishman Carbogen Amcis', sector: 'Pharma', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'DIXON', name: 'Dixon Technologies (India)', sector: 'Consumer', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'LALPATHLAB', name: 'Dr. Lal Path Labs', sector: 'Pharma', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'EDELWEISS', name: 'Edelweiss Financial Services', sector: 'Financials', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'ELGIEQUIP', name: 'Elgi Equipments', sector: 'Consumer', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'EMAMILTD', name: 'Emami', sector: 'Consumer', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'ENDURANCE', name: 'Endurance Technologies', sector: 'Auto', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'ENGINERSIN', name: 'Engineers India', sector: 'Infra', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'ERIS', name: 'Eris Lifesciences', sector: 'Pharma', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'ESCORTS', name: 'Escorts', sector: 'Auto', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'FDC', name: 'FDC', sector: 'Pharma', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'FINPIPE', name: 'Finolex Industries', sector: 'Consumer', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'FSL', name: 'Firstsource Solutions', sector: 'IT', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'FCONSUMER', name: 'Future Consumer', sector: 'Consumer', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'FLFL', name: 'Future Lifestyle Fashions', sector: 'Consumer', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'FRETAIL', name: 'Future Retail', sector: 'Consumer', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'GHCL', name: 'GHCL', sector: 'Chemicals', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'GALAXYSURF', name: 'Galaxy Surfactants', sector: 'Chemicals', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'GAYAPROJ', name: 'Gayatri Projects', sector: 'Infra', basePrice: 350, volatility: 0.25, drift: 0.1 },
  { symbol: 'GLAXO', name: 'Glaxosmithkline Pharmaceuticals', sector: 'Pharma', basePrice: 350, volatility: 0.25, drift: 0.1 },
]

// Filter duplicates against existing universe (handled at import time)
const seen = new Set<string>()
export const UNIQUE_EXTRAS: StockMeta[] = NIFTY500_EXTRA.filter((s) => {
  if (seen.has(s.symbol)) return false
  seen.add(s.symbol)
  return true
})
