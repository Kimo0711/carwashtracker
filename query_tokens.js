const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const tokens = await prisma.inviteToken.findMany();
  console.log(JSON.stringify(tokens, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
