import { z } from 'zod';

// Environment variable schema
const envSchema = z.object({
  // Server Configuration (always required)
  PORT: z.string().min(1, 'PORT is required'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Database (required for production, optional for development)
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL').optional(),

  // OpenAI Configuration (required for production, optional for development)
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required').optional(),

  // Google Sheets Configuration (required for production, optional for development)
  GOOGLE_SHEET_ID: z.string().min(1, 'GOOGLE_SHEET_ID is required').optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email('GOOGLE_SERVICE_ACCOUNT_EMAIL must be a valid email').optional(),
  GOOGLE_PRIVATE_KEY: z.string().min(1, 'GOOGLE_PRIVATE_KEY is required').optional(),

  // EvolutionAPI Configuration (required for production, optional for development)
  EVOLUTION_WEBHOOK_SECRET: z.string().min(1, 'EVOLUTION_WEBHOOK_SECRET is required').optional(),
  TARGET_GROUP_ID: z.string().min(1, 'TARGET_GROUP_ID is required').optional(),
});

// Parse and validate environment variables
const parseEnv = () => {
  try {
    const env = envSchema.parse(process.env);
    
    // In production, validate that all required variables are present
    if (env.NODE_ENV === 'production') {
      const requiredVars = [
        'DATABASE_URL',
        'OPENAI_API_KEY', 
        'GOOGLE_SHEET_ID',
        'GOOGLE_SERVICE_ACCOUNT_EMAIL',
        'GOOGLE_PRIVATE_KEY',
        'EVOLUTION_WEBHOOK_SECRET',
        'TARGET_GROUP_ID'
      ];
      
      const missingVars = requiredVars.filter(varName => !env[varName as keyof typeof env]);
      if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables in production: ${missingVars.join(', ')}`);
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
