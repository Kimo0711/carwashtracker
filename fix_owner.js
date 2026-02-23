const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const result = await prisma.user.update({
    where: { telegramId: '6150304251' },
    data: { role: 'OWNER' }
  });
  console.log('Restored OWNER:', result);
}
main().catch(console.error).finally(() => prisma.$disconnect());
