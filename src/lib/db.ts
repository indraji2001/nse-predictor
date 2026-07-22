// Database client — selects the right backend at runtime:
//
//   Priority 1 — Cloudflare D1 (PRODUCTION target — free, unlimited writes)
//     Requires: CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_D1_DATABASE_ID + CLOUDFLARE_API_TOKEN
//
//   Priority 2 — Turso / libSQL (legacy fallback — still works until D1 is active)
//     Requires: DATABASE_URL="libsql://..." + TURSO_AUTH_TOKEN
//
//   Priority 3 — Local SQLite file (local dev only)
//     Requires: DATABASE_URL="file:./db/custom.db"

import { d1db } from './d1-client'

function isD1Configured(): boolean {
  return !!(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.CLOUDFLARE_D1_DATABASE_ID &&
    process.env.CLOUDFLARE_API_TOKEN
  )
}

function isTursoConfigured(): boolean {
  const url = process.env.DATABASE_URL ?? ''
  return (url.startsWith('libsql://') || url.startsWith('https://')) && !!process.env.TURSO_AUTH_TOKEN
}

// Lazy Prisma client — used for Turso OR local SQLite
let _prismaClient: any = null
async function getPrismaClient() {
  if (_prismaClient) return _prismaClient

  const { PrismaClient } = await import('@prisma/client')

  if (isTursoConfigured()) {
    // Turso / libSQL remote — use the libSQL driver adapter (pure JS, serverless-friendly)
    const { PrismaLibSQL } = await import('@prisma/adapter-libsql')
    const adapter = new PrismaLibSQL({
      url: process.env.DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
    _prismaClient = new PrismaClient({ adapter })
  } else {
    // Local SQLite file
    _prismaClient = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    })
  }

  return _prismaClient
}

// Proxy that routes every db.xxx call to either D1 or Prisma/Turso
function createDbProxy(): any {
  if (isD1Configured()) {
    console.log('[db] Using Cloudflare D1')
    return d1db
  }

  if (isTursoConfigured()) {
    console.log('[db] Using Turso/libSQL (legacy fallback)')
  } else {
    console.log('[db] Using local SQLite')
  }

  // Prisma proxy (Turso or local SQLite)
  return new Proxy({} as any, {
    get(_target, prop: string) {
      if (['stockCandle', 'upstoxConfig', 'upstoxInstrument', 'paperTrade'].includes(prop)) {
        return new Proxy({} as any, {
          get(_modelTarget, methodName: string) {
            return async (...args: any[]) => {
              const client = await getPrismaClient()
              return (client as any)[prop][methodName](...args)
            }
          },
        })
      }
      if (prop.startsWith('$')) {
        return async (...args: any[]) => {
          const client = await getPrismaClient()
          return (client as any)[prop](...args)
        }
      }
      return undefined
    },
  })
}

// Singleton — reused across warm Lambda invocations
const globalForDb = globalThis as unknown as { _appDb: any }

// Always recreate on cold start so new env vars take effect on redeploy
export const db: typeof d1db = createDbProxy()
if (process.env.NODE_ENV !== 'production') globalForDb._appDb = db
