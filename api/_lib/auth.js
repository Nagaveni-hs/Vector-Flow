// Auth helpers for Sprint 1. Sprint 0 only ships the shape, not the
// Google OAuth flow yet. Do not trust any role sent from the frontend:
// every protected function must call requireAuth / requireAdmin here.
export function requireAuth(req) {
  // Sprint 1: verify the JWT in the httpOnly cookie, load the user,
  // check email ends with @vvce.ac.in, and return the user.
  // Until then, this intentionally throws, so no protected route
  // can accidentally open.
  throw new Error('AUTH_NOT_IMPLEMENTED')
}

export function requireAdmin(req) {
  const user = requireAuth(req)
  if (user.role !== 'ADMIN') {
    const err = new Error('FORBIDDEN')
    err.status = 403
    throw err
  }
  return user
}
