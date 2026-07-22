import { createClient } from '@libsql/client'

const TURSO_URL = 'libsql://nse-predictor-indraji2001.aws-eu-west-1.turso.io'
const TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3ODQyMzk1NjMsImlkIjoiMDE5ZjZjZjYtYjkwMS03Y2Y3LTkxNGEtMGQ0MGUxNGQ5N2FiIiwia2lkIjoiaGFpQkk0ZHRCRVZoYkJkLWpNR2tRUzBPYWs1OGxiWXM0bXNDSGVZRC1ZUSIsInJpZCI6IjUzOGEyYTdjLTEzN2UtNGVjZS1hOGY3LTU5MjRhYjE2OWMxOCJ9.ksj-GNnyi54RRTJARxOvfT58rR0CJKHKu9L4h0pXuXF8WBM1CvyN1UBLoQ9AnIVk-M2E2uDMMqUW7QCZCp8QBQ'

const D1_ACCOUNT = '588616c794f2e656f0abc2f364a5db8b'
const D1_DB = '158e64d6-170f-4781-af59-4cb5c23da9e5'
const D1_TOKEN = 'cfut_x5Mg7fjh7Ndg6GT8ReBfzPirTQtnoCMyWLuvDLT03211460f'

const d1Endpoint = `https://api.cloudflare.com/client/v4/accounts/${D1_ACCOUNT}/d1/database/${D1_DB}/query`

async function d1Exec(sql, params = []) {
  const res = await fetch(d1Endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${D1_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
  })
  const json = await res.json()
  if (!json.success) {
    throw new Error(`D1 error: ${JSON.stringify(json.errors)}`)
  }
  return json.result
}

async function migrate() {
  console.log('Connecting to Turso...')
  const turso = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN })

  // 1. Migrate UpstoxConfig
  console.log('Reading UpstoxConfig from Turso...')
  const cfgResult = await turso.execute('SELECT * FROM UpstoxConfig WHERE id = 1')
  if (cfgResult.rows.length > 0) {
    const r = cfgResult.rows[0]
    console.log('Migrating UpstoxConfig to D1...')
    await d1Exec(
      `INSERT OR REPLACE INTO "UpstoxConfig" ("id", "apiKey", "apiSecret", "redirectUri", "accessToken", "refreshToken", "tokenExpiresAt", "lastUsedAt", "createdAt", "updatedAt")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.id,
        r.apiKey ?? '',
        r.apiSecret ?? '',
        r.redirectUri ?? '',
        r.accessToken ?? null,
        r.refreshToken ?? null,
        r.tokenExpiresAt ? new Date(r.tokenExpiresAt).toISOString() : null,
        r.lastUsedAt ? new Date(r.lastUsedAt).toISOString() : null,
        r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
        r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
      ]
    )
    console.log('✅ UpstoxConfig migrated successfully!')
  }

  // 2. Migrate UpstoxInstrument in chunks of 50
  console.log('Reading UpstoxInstrument from Turso...')
  const instResult = await turso.execute('SELECT * FROM UpstoxInstrument')
  console.log(`Found ${instResult.rows.length} instrument keys in Turso. Bulk migrating...`)
  
  const chunkSize = 10
  for (let i = 0; i < instResult.rows.length; i += chunkSize) {
    const chunk = instResult.rows.slice(i, i + chunkSize)
    const valuePlaceholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ')
    const params = []
    for (const r of chunk) {
      params.push(
        r.symbol,
        r.instrumentKey,
        r.name ?? null,
        r.exchange ?? 'NSE_EQ',
        r.isin ?? null,
        r.lotSize ?? null,
        r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString()
      )
    }
    await d1Exec(
      `INSERT OR REPLACE INTO "UpstoxInstrument" ("symbol", "instrumentKey", "name", "exchange", "isin", "lotSize", "updatedAt")
       VALUES ${valuePlaceholders}`,
      params
    )
    console.log(`Migrated ${Math.min(i + chunkSize, instResult.rows.length)} / ${instResult.rows.length} instruments`)
  }
  console.log(`✅ All ${instResult.rows.length} UpstoxInstrument keys migrated to D1!`)

  // 3. Migrate PaperTrade
  console.log('Reading PaperTrade from Turso...')
  const tradeResult = await turso.execute('SELECT * FROM PaperTrade')
  if (tradeResult.rows.length > 0) {
    for (const r of tradeResult.rows) {
      await d1Exec(
        `INSERT OR REPLACE INTO "PaperTrade" ("id", "symbol", "name", "sector", "timeframe", "entryPrice", "stopLoss", "target1", "target2", "target3", "riskReward", "holdingPeriod", "confidence", "status", "currentPrice", "maxPrice", "minPrice", "pnlPct", "hitTargets", "trackedAt", "updatedAt", "closedAt", "notes")
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.id, r.symbol, r.name, r.sector, r.timeframe,
          r.entryPrice, r.stopLoss, r.target1, r.target2, r.target3,
          r.riskReward, r.holdingPeriod, r.confidence, r.status,
          r.currentPrice, r.maxPrice, r.minPrice, r.pnlPct, r.hitTargets,
          r.trackedAt ? new Date(r.trackedAt).toISOString() : new Date().toISOString(),
          r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
          r.closedAt ? new Date(r.closedAt).toISOString() : null,
          r.notes ?? null,
        ]
      )
    }
  }
  console.log(`✅ All ${tradeResult.rows.length} paper trades migrated to D1!`)

  console.log('🎉 Full Turso -> Cloudflare D1 data migration COMPLETE!')
}

migrate().catch(console.error)
