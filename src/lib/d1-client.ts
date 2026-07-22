// Cloudflare D1 REST API client — drop-in replacement for Prisma + Turso.
//
// D1 free tier: 50M row writes/day, 25M row reads/day, 10GB storage.
// No "rows written quota" emails. No billing. Forever free at this scale.
//
// This module provides a Prisma-compatible interface so callers (upstox.ts,
// candle-cache.ts, papertrade routes, etc.) need ZERO changes.
//
// Environment variables required (set in Vercel + .env.local):
//   CLOUDFLARE_ACCOUNT_ID      — from the URL bar of dash.cloudflare.com
//   CLOUDFLARE_D1_DATABASE_ID  — shown after creating a D1 database
//   CLOUDFLARE_API_TOKEN       — API token with D1:Edit permission

const D1_ENDPOINT = () =>
  `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${process.env.CLOUDFLARE_D1_DATABASE_ID}/query`

// Execute one or more SQL statements via the D1 REST API.
// Returns the rows from the LAST statement.
async function d1Query(sql: string, params: (string | number | null | boolean)[] = []): Promise<any[]> {
  const res = await fetch(D1_ENDPOINT(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`D1 HTTP ${res.status}: ${text.slice(0, 400)}`)
  }
  const data = await res.json() as any
  if (!data.success) {
    const msg = data.errors?.[0]?.message ?? JSON.stringify(data.errors)
    throw new Error(`D1 query failed: ${msg}`)
  }
  // data.result is an array of statement results; return rows from the last one
  const lastResult = data.result?.[data.result.length - 1]
  return lastResult?.results ?? []
}

// Execute raw SQL — returns rows count via meta.changes
async function d1Exec(sql: string, params: (string | number | null | boolean)[] = []): Promise<number> {
  const res = await fetch(D1_ENDPOINT(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`D1 HTTP ${res.status}: ${text.slice(0, 400)}`)
  }
  const data = await res.json() as any
  if (!data.success) {
    const msg = data.errors?.[0]?.message ?? JSON.stringify(data.errors)
    throw new Error(`D1 exec failed: ${msg}`)
  }
  const lastResult = data.result?.[data.result.length - 1]
  return lastResult?.meta?.changes ?? 0
}

// ---------------------------------------------------------------------------
//  WHERE clause builder — handles the subset of Prisma `where` objects used
//  in this app.  Supported operators: equals (plain value), in, gte, lte, lt.
// ---------------------------------------------------------------------------
function buildWhere(where: Record<string, any>): { clause: string; params: any[] } {
  const parts: string[] = []
  const params: any[] = []

  for (const [col, val] of Object.entries(where)) {
    if (val === null || val === undefined) {
      parts.push(`"${col}" IS NULL`)
    } else if (typeof val === 'object' && !Array.isArray(val)) {
      // Operator object: { in: [...] } | { gte: x } | { lte: x } | { lt: x }
      if ('in' in val) {
        const placeholders = (val.in as any[]).map(() => '?').join(', ')
        parts.push(`"${col}" IN (${placeholders})`)
        params.push(...val.in)
      } else {
        if ('gte' in val) { parts.push(`"${col}" >= ?`); params.push(val.gte) }
        if ('lte' in val) { parts.push(`"${col}" <= ?`); params.push(val.lte) }
        if ('lt'  in val) { parts.push(`"${col}" < ?`);  params.push(val.lt)  }
        if ('gt'  in val) { parts.push(`"${col}" > ?`);  params.push(val.gt)  }
      }
    } else {
      parts.push(`"${col}" = ?`)
      params.push(val)
    }
  }

  return {
    clause: parts.length > 0 ? `WHERE ${parts.join(' AND ')}` : '',
    params,
  }
}

// ---------------------------------------------------------------------------
//  StockCandle model
// ---------------------------------------------------------------------------
const stockCandle = {
  async findMany(opts: {
    where?: Record<string, any>
    orderBy?: Record<string, 'asc' | 'desc'>
    take?: number
  } = {}): Promise<any[]> {
    const { clause, params } = buildWhere(opts.where ?? {})
    const order = opts.orderBy
      ? `ORDER BY ${Object.entries(opts.orderBy).map(([c, d]) => `"${c}" ${d.toUpperCase()}`).join(', ')}`
      : ''
    const limit = opts.take ? `LIMIT ${opts.take}` : ''
    return d1Query(`SELECT * FROM "StockCandle" ${clause} ${order} ${limit}`.trim(), params)
  },

  async count(opts: { where?: Record<string, any> } = {}): Promise<number> {
    const { clause, params } = buildWhere(opts.where ?? {})
    const rows = await d1Query(`SELECT COUNT(*) as cnt FROM "StockCandle" ${clause}`.trim(), params)
    return Number(rows[0]?.cnt ?? 0)
  },

  async deleteMany(opts: { where?: Record<string, any> } = {}): Promise<{ count: number }> {
    const { clause, params } = buildWhere(opts.where ?? {})
    const changes = await d1Exec(`DELETE FROM "StockCandle" ${clause}`.trim(), params)
    return { count: changes }
  },
}

// ---------------------------------------------------------------------------
//  UpstoxConfig model (singleton row id=1)
// ---------------------------------------------------------------------------
const upstoxConfig = {
  async findUnique(opts: { where: { id: number } }): Promise<any | null> {
    const rows = await d1Query(`SELECT * FROM "UpstoxConfig" WHERE "id" = ?`, [opts.where.id])
    if (!rows[0]) return null
    const r = rows[0]
    return {
      ...r,
      tokenExpiresAt: r.tokenExpiresAt ? new Date(r.tokenExpiresAt) : null,
      lastUsedAt:     r.lastUsedAt     ? new Date(r.lastUsedAt)     : null,
      createdAt:      r.createdAt      ? new Date(r.createdAt)      : null,
      updatedAt:      r.updatedAt      ? new Date(r.updatedAt)      : null,
    }
  },

  async upsert(opts: { where: { id: number }; create: Record<string, any>; update: Record<string, any> }): Promise<any> {
    const existing = await upstoxConfig.findUnique({ where: opts.where })
    if (existing) {
      return upstoxConfig.update({ where: opts.where, data: opts.update })
    }
    const data = { ...opts.create, id: opts.where.id }
    const cols = Object.keys(data).map(c => `"${c}"`).join(', ')
    const placeholders = Object.keys(data).map(() => '?').join(', ')
    const vals = Object.values(data).map(v => v instanceof Date ? v.toISOString() : v)
    await d1Exec(`INSERT INTO "UpstoxConfig" (${cols}) VALUES (${placeholders})`, vals as any)
    return upstoxConfig.findUnique({ where: opts.where })
  },

  async update(opts: { where: { id: number }; data: Record<string, any> }): Promise<any> {
    const now = new Date().toISOString()
    const setData = { ...opts.data, updatedAt: now }
    const sets = Object.keys(setData).map(c => `"${c}" = ?`).join(', ')
    const vals = Object.values(setData).map(v => v instanceof Date ? v.toISOString() : v)
    await d1Exec(`UPDATE "UpstoxConfig" SET ${sets} WHERE "id" = ?`, [...vals, opts.where.id] as any)
    return upstoxConfig.findUnique({ where: opts.where })
  },
}

// ---------------------------------------------------------------------------
//  UpstoxInstrument model
// ---------------------------------------------------------------------------
const upstoxInstrument = {
  async findUnique(opts: { where: { symbol: string } }): Promise<any | null> {
    const rows = await d1Query(`SELECT * FROM "UpstoxInstrument" WHERE "symbol" = ?`, [opts.where.symbol])
    return rows[0] ?? null
  },

  async findMany(opts: { select?: Record<string, boolean>; where?: Record<string, any> } = {}): Promise<any[]> {
    const cols = opts.select
      ? Object.entries(opts.select).filter(([, v]) => v).map(([c]) => `"${c}"`).join(', ')
      : '*'
    const { clause, params } = buildWhere(opts.where ?? {})
    return d1Query(`SELECT ${cols} FROM "UpstoxInstrument" ${clause}`.trim(), params)
  },

  async deleteMany(_opts: { where?: Record<string, any> } = {}): Promise<{ count: number }> {
    const changes = await d1Exec(`DELETE FROM "UpstoxInstrument"`)
    return { count: changes }
  },

  async create(opts: { data: Record<string, any> }): Promise<any> {
    const data = opts.data
    const cols = Object.keys(data).map(c => `"${c}"`).join(', ')
    const placeholders = Object.keys(data).map(() => '?').join(', ')
    const vals = Object.values(data).map(v => v instanceof Date ? v.toISOString() : v)
    await d1Exec(`INSERT OR IGNORE INTO "UpstoxInstrument" (${cols}) VALUES (${placeholders})`, vals as any)
    return upstoxInstrument.findUnique({ where: { symbol: data.symbol } })
  },
}

// ---------------------------------------------------------------------------
//  PaperTrade model
// ---------------------------------------------------------------------------
const paperTrade = {
  _mapRow(r: any) {
    if (!r) return null
    return {
      ...r,
      trackedAt: r.trackedAt ? new Date(r.trackedAt) : null,
      updatedAt:  r.updatedAt  ? new Date(r.updatedAt)  : null,
      closedAt:   r.closedAt   ? new Date(r.closedAt)   : null,
    }
  },

  async findFirst(opts: { where?: Record<string, any> } = {}): Promise<any | null> {
    const { clause, params } = buildWhere(opts.where ?? {})
    const rows = await d1Query(`SELECT * FROM "PaperTrade" ${clause} LIMIT 1`.trim(), params)
    return this._mapRow(rows[0])
  },

  async findMany(opts: {
    where?: Record<string, any>
    orderBy?: Record<string, 'asc' | 'desc'>
  } = {}): Promise<any[]> {
    const { clause, params } = buildWhere(opts.where ?? {})
    const order = opts.orderBy
      ? `ORDER BY ${Object.entries(opts.orderBy).map(([c, d]) => `"${c}" ${d.toUpperCase()}`).join(', ')}`
      : 'ORDER BY "trackedAt" DESC'
    const rows = await d1Query(`SELECT * FROM "PaperTrade" ${clause} ${order}`.trim(), params)
    return rows.map(r => this._mapRow(r))
  },

  async create(opts: { data: Record<string, any> }): Promise<any> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const data = {
      id,
      ...opts.data,
      status: opts.data.status ?? 'ACTIVE',
      hitTargets: opts.data.hitTargets ?? '[]',
      maxPrice: opts.data.maxPrice ?? 0,
      minPrice: opts.data.minPrice ?? 0,
      pnlPct: opts.data.pnlPct ?? 0,
      trackedAt: now,
      updatedAt: now,
    }
    const cols = Object.keys(data).map(c => `"${c}"`).join(', ')
    const placeholders = Object.keys(data).map(() => '?').join(', ')
    const vals = Object.values(data).map(v => v instanceof Date ? v.toISOString() : v)
    await d1Exec(`INSERT INTO "PaperTrade" (${cols}) VALUES (${placeholders})`, vals as any)
    return this.findFirst({ where: { id } })
  },

  async update(opts: { where: { id: string }; data: Record<string, any> }): Promise<any> {
    const now = new Date().toISOString()
    const setData = { ...opts.data, updatedAt: now }
    const sets = Object.keys(setData).map(c => `"${c}" = ?`).join(', ')
    const vals = Object.values(setData).map(v => v instanceof Date ? v.toISOString() : v)
    await d1Exec(`UPDATE "PaperTrade" SET ${sets} WHERE "id" = ?`, [...vals, opts.where.id] as any)
    return this.findFirst({ where: { id: opts.where.id } })
  },

  async delete(opts: { where: { id: string } }): Promise<any> {
    const row = await this.findFirst({ where: { id: opts.where.id } })
    await d1Exec(`DELETE FROM "PaperTrade" WHERE "id" = ?`, [opts.where.id])
    return row
  },

  async count(opts: { where?: Record<string, any> } = {}): Promise<number> {
    const { clause, params } = buildWhere(opts.where ?? {})
    const rows = await d1Query(`SELECT COUNT(*) as cnt FROM "PaperTrade" ${clause}`.trim(), params)
    return Number(rows[0]?.cnt ?? 0)
  },
}

// ---------------------------------------------------------------------------
//  UniverseCache model (single-row per key fast JSON store for sub-second universe responses)
// ---------------------------------------------------------------------------
const universeCache = {
  async findUnique(opts: { where: { key: string } }): Promise<{ key: string; payload: string; updatedAt: string } | null> {
    try {
      const rows = await d1Query(`SELECT * FROM "UniverseCache" WHERE "key" = ?`, [opts.where.key])
      return rows[0] ?? null
    } catch {
      return null
    }
  },

  async upsert(opts: { where: { key: string }; create: { key: string; payload: string }; update: { payload: string } }): Promise<any> {
    try {
      const key = opts.where.key
      const payload = opts.update.payload ?? opts.create.payload
      const now = new Date().toISOString()
      await d1Exec(
        `INSERT INTO "UniverseCache" ("key", "payload", "updatedAt") VALUES (?, ?, ?)
         ON CONFLICT("key") DO UPDATE SET "payload" = excluded."payload", "updatedAt" = excluded."updatedAt"`,
        [key, payload, now]
      )
      return { key, payload, updatedAt: now }
    } catch (err) {
      console.error('[D1] Error upserting UniverseCache:', err)
      return null
    }
  },
}

// ---------------------------------------------------------------------------
//  Public db-compatible object
// ---------------------------------------------------------------------------
export const d1db = {
  stockCandle,
  upstoxConfig,
  upstoxInstrument,
  paperTrade,
  universeCache,

  // Raw SQL escape hatch (used by candle-cache for bulk upserts)
  async $executeRawUnsafe(sql: string): Promise<number> {
    return d1Exec(sql)
  },
}

// Schema creation SQL — run once via /api/admin/init-d1 to create all tables.
export const D1_SCHEMA = `
CREATE TABLE IF NOT EXISTS "UpstoxConfig" (
  "id"             INTEGER PRIMARY KEY DEFAULT 1,
  "apiKey"         TEXT    NOT NULL DEFAULT '',
  "apiSecret"      TEXT    NOT NULL DEFAULT '',
  "redirectUri"    TEXT    NOT NULL DEFAULT '',
  "accessToken"    TEXT,
  "refreshToken"   TEXT,
  "tokenExpiresAt" TEXT,
  "lastUsedAt"     TEXT,
  "createdAt"      TEXT    NOT NULL DEFAULT (datetime('now')),
  "updatedAt"      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "UpstoxInstrument" (
  "symbol"        TEXT PRIMARY KEY,
  "instrumentKey" TEXT NOT NULL,
  "name"          TEXT,
  "exchange"      TEXT NOT NULL DEFAULT 'NSE_EQ',
  "isin"          TEXT,
  "lotSize"       INTEGER,
  "updatedAt"     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS "UpstoxInstrument_exchange_idx" ON "UpstoxInstrument"("exchange");

CREATE TABLE IF NOT EXISTS "StockCandle" (
  "id"        INTEGER PRIMARY KEY AUTOINCREMENT,
  "symbol"    TEXT    NOT NULL,
  "date"      TEXT    NOT NULL,
  "open"      REAL    NOT NULL,
  "high"      REAL    NOT NULL,
  "low"       REAL    NOT NULL,
  "close"     REAL    NOT NULL,
  "volume"    REAL    NOT NULL,
  "interval"  TEXT    NOT NULL,
  "source"    TEXT    NOT NULL,
  "createdAt" TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE ("symbol", "date", "interval", "source")
);
CREATE INDEX IF NOT EXISTS "StockCandle_symbol_interval_source_idx" ON "StockCandle"("symbol", "interval", "source");
CREATE INDEX IF NOT EXISTS "StockCandle_date_idx" ON "StockCandle"("date");

CREATE TABLE IF NOT EXISTS "PaperTrade" (
  "id"            TEXT    PRIMARY KEY,
  "symbol"        TEXT    NOT NULL,
  "name"          TEXT    NOT NULL,
  "sector"        TEXT    NOT NULL,
  "timeframe"     TEXT    NOT NULL,
  "entryPrice"    REAL    NOT NULL,
  "stopLoss"      REAL    NOT NULL,
  "target1"       REAL    NOT NULL,
  "target2"       REAL    NOT NULL,
  "target3"       REAL    NOT NULL,
  "riskReward"    REAL    NOT NULL DEFAULT 0,
  "holdingPeriod" TEXT    NOT NULL DEFAULT '',
  "confidence"    INTEGER NOT NULL DEFAULT 0,
  "status"        TEXT    NOT NULL DEFAULT 'ACTIVE',
  "currentPrice"  REAL,
  "maxPrice"      REAL    NOT NULL DEFAULT 0,
  "minPrice"      REAL    NOT NULL DEFAULT 0,
  "pnlPct"        REAL    NOT NULL DEFAULT 0,
  "hitTargets"    TEXT    NOT NULL DEFAULT '[]',
  "trackedAt"     TEXT    NOT NULL DEFAULT (datetime('now')),
  "updatedAt"     TEXT    NOT NULL DEFAULT (datetime('now')),
  "closedAt"      TEXT,
  "notes"         TEXT
);
CREATE INDEX IF NOT EXISTS "PaperTrade_symbol_idx"    ON "PaperTrade"("symbol");
CREATE INDEX IF NOT EXISTS "PaperTrade_status_idx"    ON "PaperTrade"("status");
CREATE INDEX IF NOT EXISTS "PaperTrade_timeframe_idx" ON "PaperTrade"("timeframe");

CREATE TABLE IF NOT EXISTS "UniverseCache" (
  "key"        TEXT PRIMARY KEY,
  "payload"    TEXT NOT NULL,
  "updatedAt"  TEXT NOT NULL DEFAULT (datetime('now'))
);
`
