const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany({ select: { id: true, email: true, creditsLeft: true } });
    console.log("SUCCESS! Connected to DB.");
    console.log("Users in DB:", users);
  } catch (error) {
    console.error("DB CONNECTION ERROR:");
    console.error(error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
