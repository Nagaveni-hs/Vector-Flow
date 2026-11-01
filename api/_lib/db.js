import { PrismaClient } from '@prisma/client'

// Singleton Prisma client. In serverless functions, never create a new
// client per request, or database connections pile up.
// Use the Neon POOLED connection string in DATABASE_URL in production.
const globalForPrisma = globalThis

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export function ok(res, data, status = 200) {
  res.status(status).json({ ok: true, data })
}

export function fail(res, error, status = 400) {
  res.status(status).json({ ok: false, error })
}
