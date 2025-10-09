import pino from 'pino';

const isDevelopment = process.env['NODE_ENV'] === 'development';
const isTest = process.env['NODE_ENV'] === 'test';

// Create logger instance
const loggerOptions: any = {
  level: process.env['LOG_LEVEL'] || (isDevelopment ? 'debug' : 'info'),
  formatters: {
    level: (label: string) => {
      return { level: label };
    }
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'req.body.password',
      'req.body.token',
      'req.body.secret',
      'response.body.password',
      'response.body.token',
      'response.body.secret'
    ],
    censor: '[REDACTED]'
  }
};

// Add transport only in development and not in test
if (isDevelopment && !isTest) {
  loggerOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  };
}

const logger = pino(loggerOptions);

export { logger };
