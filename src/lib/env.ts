import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config(); // Fallback to .env

// Environment variable schema
const envSchema = z.object({
  // Server Configuration (always required)
  PORT: z.string().min(1, 'PORT is required').default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Database (required for production, optional for development)
  DATABASE_URL: z.string().optional(),

  // OpenAI Configuration (optional - will be validated when used)
  OPENAI_API_KEY: z.string().optional(),

  // Google Sheets Configuration (optional - will be validated when used)
  GOOGLE_SHEET_ID: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
  GOOGLE_PRIVATE_KEY: z.string().optional(),

  // EvolutionAPI Configuration (optional - will be validated when used)
  EVOLUTION_WEBHOOK_SECRET: z.string().optional(),
  TARGET_GROUP_ID: z.string().optional(),
});

// Parse and validate environment variables
const parseEnv = () => {
  try {
    const env = envSchema.parse(process.env);
    
    // Log warnings for missing production variables instead of crashing
    if (env.NODE_ENV === 'production') {
      const missingVars = [];
      if (!env.DATABASE_URL) missingVars.push('DATABASE_URL');
      if (!env.OPENAI_API_KEY) missingVars.push('OPENAI_API_KEY');
      if (!env.GOOGLE_SHEET_ID) missingVars.push('GOOGLE_SHEET_ID');
      if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL) missingVars.push('GOOGLE_SERVICE_ACCOUNT_EMAIL');
      if (!env.GOOGLE_PRIVATE_KEY) missingVars.push('GOOGLE_PRIVATE_KEY');
      if (!env.EVOLUTION_WEBHOOK_SECRET) missingVars.push('EVOLUTION_WEBHOOK_SECRET');
      if (!env.TARGET_GROUP_ID) missingVars.push('TARGET_GROUP_ID');
      
      if (missingVars.length > 0) {
        console.warn(`⚠️  Missing production environment variables: ${missingVars.join(', ')}`);
        console.warn('⚠️  Some features may not work properly without these variables.');
      }
    }
    
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(
        (err) => `${err.path.join('.')}: ${err.message}`
      );
      throw new Error(`Environment validation failed:\n${errorMessages.join('\n')}`);
    }
    throw error;
  }
};

// Export validated environment variables
export const env = parseEnv();

// Type for environment variables
export type Env = z.infer<typeof envSchema>;

// Helper function to check if we're in development
export const isDevelopment = env.NODE_ENV === 'development';

// Helper function to check if we're in production
export const isProduction = env.NODE_ENV === 'production';

// Helper function to check if we're in test
export const isTest = env.NODE_ENV === 'test';

// Helper functions for runtime validation
export const validateRequiredVar = (name: string, value: string | undefined): string => {
  if (!value) {
    throw new Error(`${name} is required but not set`);
  }
  return value;
};

export const validateUrl = (name: string, value: string | undefined): string => {
  const validated = validateRequiredVar(name, value);
  try {
    new URL(validated);
    return validated;
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
};

export const validateEmail = (name: string, value: string | undefined): string => {
  const validated = validateRequiredVar(name, value);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(validated)) {
    throw new Error(`${name} must be a valid email address`);
  }
  return validated;
};
