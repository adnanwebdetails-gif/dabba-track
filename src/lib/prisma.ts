import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from '../generated/prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = (() => {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }
  
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/dabbatrack';
  const adapter = new PrismaPg({
    connectionString,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 300000,
  });
  
  return new PrismaClient({ adapter });
})();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
