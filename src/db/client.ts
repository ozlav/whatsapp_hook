import { PrismaClient } from '@prisma/client';
import { env } from '../lib/env';
import { logger } from '../lib/logger';

// Global Prisma client instance
let prisma: PrismaClient | null = null;

// Get or create Prisma client instance
export const getPrismaClient = (): PrismaClient | null => {
  if (!prisma) {
    // Validate DATABASE_URL is available
    const databaseUrl = env.DATABASE_URL;
    if (!databaseUrl) {
      logger.warn('DATABASE_URL is not set, database operations will be skipped');
      return null;
    }

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      log: env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  }

  return prisma;
};

// Test database connection
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    const client = getPrismaClient();
    if (!client) {
      logger.warn('Database client not available');
      return false;
    }
    await client.$queryRaw`SELECT 1`;
    logger.info('Database connection successful');
    return true;
  } catch (error) {
    logger.error('Database connection failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    return false;
  }
};

// Graceful shutdown
export const disconnectDatabase = async (): Promise<void> => {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
    logger.info('Database disconnected');
  }
};

// Export the client getter as default
export default getPrismaClient;
