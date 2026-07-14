import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'demo@courtreach.local';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // eslint-disable-next-line no-console
    console.log('Seed already applied (demo user exists).');
    return;
  }

  const passwordHash = await bcrypt.hash('password123', 10);
  const user = await prisma.user.create({ data: { email, name: 'Demo User', passwordHash } });
  const team = await prisma.team.create({ data: { name: 'Demo Team' } });
  await prisma.membership.create({ data: { userId: user.id, teamId: team.id, role: 'OWNER' } });

  // eslint-disable-next-line no-console
  console.log(`Seeded demo account: ${email} / password123`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
