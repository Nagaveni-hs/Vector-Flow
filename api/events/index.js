// Public events list. Sprint 1 replaces the empty list with a real
// Prisma query for PUBLISHED events, ordered by start date.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  }
  return res.status(200).json({ ok: true, data: [] })
}
