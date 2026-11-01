// Mail helpers for Sprint 2. Sprint 0 only ships the shape.
// Transport uses SMTP from vectorflow@vvce.ac.in, configured only
// from environment variables, never from code or chat.
export async function sendMail({ to, subject, html }) {
  throw new Error('MAIL_NOT_IMPLEMENTED')
}
