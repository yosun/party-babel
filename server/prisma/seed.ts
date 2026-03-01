import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create a default organization
  const org = await prisma.organization.upsert({
    where: { id: 'default-org' },
    update: {},
    create: {
      id: 'default-org',
      name: 'Party Babel Demo',
    },
  });

  // Create demo users
  const alice = await prisma.user.upsert({
    where: { id: 'alice' },
    update: {},
    create: {
      id: 'alice',
      email: 'alice@demo.local',
      displayName: 'Alice',
      tier: 'pro',
    },
  });

  const bob = await prisma.user.upsert({
    where: { id: 'bob' },
    update: {},
    create: {
      id: 'bob',
      email: 'bob@demo.local',
      displayName: 'Bob',
      tier: 'free',
    },
  });

  const carlos = await prisma.user.upsert({
    where: { id: 'carlos' },
    update: {},
    create: {
      id: 'carlos',
      email: 'carlos@demo.local',
      displayName: 'Carlos',
      tier: 'free',
    },
  });

  // Create demo room
  const room = await prisma.room.upsert({
    where: { id: 'demo-room' },
    update: {},
    create: {
      id: 'demo-room',
      name: 'Demo Room',
      organizationId: org.id,
    },
  });

  console.log('Seed completed:', { org: org.id, users: [alice.id, bob.id, carlos.id], room: room.id });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
