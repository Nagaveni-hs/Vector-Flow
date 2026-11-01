// Local test seed only. Never run this against production.
// Usage: npx prisma db seed
// It needs DATABASE_URL set. The admin email below must be replaced
// with a real team member's @vvce.ac.in address before first use.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@vvce.ac.in'
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'ADMIN' },
    create: { name: 'Vector Flow Admin', email: adminEmail, role: 'ADMIN' },
  })
  console.log(`Seed done. Admin: ${adminEmail}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
