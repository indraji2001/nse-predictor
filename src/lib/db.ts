// Database client — selects the right backend at runtime:
//
//   PRODUCTION (Vercel + Cloudflare D1):
//     CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_D1_DATABASE_ID + CLOUDFLARE_API_TOKEN
//     → uses src/lib/d1-client.ts (pure-JS REST, no native binaries needed)
//
//   LOCAL DEV (SQLite file, fallback):
//     DATABASE_URL="file:./db/custom.db" → uses Prisma's default SQLite engine
//     Useful for rapid local iteration without cloud credentials.
//
// All callers import `db` from this file. The interface is identical
// regardless of which backend is active.

import { d1db } from './d1-client'

// Check if Cloudflare D1 credentials are configured
function isD1Configured(): boolean {
  return !!(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.CLOUDFLARE_D1_DATABASE_ID &&
    process.env.CLOUDFLARE_API_TOKEN
  )
}

// Lazy Prisma client for local dev SQLite (only imported when D1 is not configured)
let _prismaClient: any = null
async function getPrismaClient() {
  if (_prismaClient) return _prismaClient
  const { PrismaClient } = await import('@prisma/client')
  _prismaClient = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
  return _prismaClient
}

// Proxy that routes every db.xxx call to either D1 or Prisma
function createDbProxy(): any {
  if (isD1Configured()) {
    // Production: use Cloudflare D1 REST client
    return d1db
  }

  // Local dev: use Prisma SQLite (lazy-loaded to avoid import cost in production)
  return new Proxy({} as any, {
    get(_target, prop: string) {
      // Return a proxy for model-level operations (e.g. db.stockCandle.findMany)
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
      // Raw SQL ($executeRawUnsafe, $queryRaw, etc.)
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
export const db: typeof d1db = globalForDb._appDb ?? createDbProxy()
if (process.env.NODE_ENV !== 'production') globalForDb._appDb = db
