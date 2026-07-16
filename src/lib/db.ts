// Prisma client with libSQL driver adapter.
//
// This file works in BOTH environments:
//   - Local dev  : DATABASE_URL="file:./db/custom.db"  → uses Prisma's default SQLite engine
//   - Production : DATABASE_URL="libsql://<db>.turso.io" + TURSO_AUTH_TOKEN → uses @libsql/client
//
// The driver adapter is selected at runtime based on the URL scheme.
//
// Why a driver adapter instead of plain Prisma?
//   Vercel's serverless functions run on Node.js, and Prisma's default
//   SQLite engine ships a native binary that doesn't always play nicely
//   with Vercel's Lambdas. The libSQL adapter is a pure-JS driver that
//   works anywhere. Turso (https://turso.tech) is a hosted libSQL
//   service with a generous free tier — perfect for personal projects.

import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

// Detect runtime: are we on Vercel/production with a Turso URL?
function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL ?? ''
  const isTurso = databaseUrl.startsWith('libsql://') || databaseUrl.startsWith('https://')

  if (isTurso) {
    // Turso / libSQL remote — use the libSQL driver adapter (pure JS, serverless-friendly).
    if (!process.env.TURSO_AUTH_TOKEN) {
      console.warn('[db] WARNING: DATABASE_URL is a libsql:// URL but TURSO_AUTH_TOKEN is not set. Authentication will fail.')
    }
    const adapter = new PrismaLibSQL({
      url: databaseUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
    return new PrismaClient({ adapter })
  }

  // Local SQLite — use Prisma's default engine (no adapter needed).
  // Prisma will read DATABASE_URL like "file:./db/custom.db" directly.
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

// Cache the client on globalThis so HMR in dev doesn't open hundreds of connections.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
