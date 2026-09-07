const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding employees...');

  const users = [
    {
      name: 'Arul Xavier (Master Admin)',
      email: 'admin@gapanchor.com',
      password: 'admin123#password', // Plain text / demo password
      role: 'admin',
      assignedCourse: 'All Platforms',
    },
    {
      name: 'Employee A (Manhattan WMS)',
      email: 'employee.a@gapanchor.com',
      password: 'employee123#password',
      role: 'employee',
      assignedCourse: 'Manhattan WMS',
    },
    {
      name: 'Employee B (Blue Yonder & Kinaxis)',
      email: 'employee.b@gapanchor.com',
      password: 'employee123#password',
      role: 'employee',
      assignedCourse: 'Blue Yonder',
    },
    {
      name: 'Employee C (SAP S/4HANA)',
      email: 'employee.c@gapanchor.com',
      password: 'employee123#password',
      role: 'employee',
      assignedCourse: 'SAP S/4HANA',
    },
  ];

  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (!existing) {
      const created = await prisma.user.create({ data: u });
      console.log(`Created user: ${created.name} (${created.email})`);
    } else {
      console.log(`User already exists: ${existing.name}`);
    }
  }

  console.log('Done seeding users!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
