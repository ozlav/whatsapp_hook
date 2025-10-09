# Zehava WhatsApp Webhook Service

A WhatsApp webhook processing system that integrates with EvolutionAPI, OpenAI, and Google Sheets.

## Features

- **WhatsApp Webhook Processing**: Receives and processes messages from EvolutionAPI
- **OpenAI Integration**: Uses LangGraph to process unstructured messages
- **Google Sheets Integration**: Stores structured data in Google Sheets
- **Health Monitoring**: Comprehensive health checks for monitoring
- **Environment Validation**: Flexible configuration for development and production

## Quick Start

### Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set environment variables**:
   ```bash
   cp env.example .env
   # Edit .env with your values
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Run tests**:
   ```bash
   npm test
   ```

### Production (Railway)

1. **Deploy to Railway**:
   - Connect your GitHub repository to Railway
   - Set environment variables in Railway dashboard
   - Deploy automatically on push to main branch

2. **Required Environment Variables**:
   - `PORT`: Server port (Railway sets this automatically)
   - `NODE_ENV`: Environment (development/production/test)
   - `LOG_LEVEL`: Logging level (error/warn/info/debug)
   - `DATABASE_URL`: PostgreSQL connection string
   - `OPENAI_API_KEY`: OpenAI API key
   - `GOOGLE_SHEET_ID`: Google Sheets ID
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Service account email
   - `GOOGLE_PRIVATE_KEY`: Service account private key
   - `EVOLUTION_WEBHOOK_SECRET`: Webhook secret for validation
   - `TARGET_GROUP_ID`: WhatsApp group ID to monitor

## API Endpoints

### Health Checks
- `GET /health` - Basic health status
- `GET /health/detailed` - Detailed health information

### Webhooks
- `POST /webhook/whatsapp` - EvolutionAPI webhook endpoint
- `GET /webhook/test` - Test webhook functionality

## Development

### Scripts
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage

### Testing
```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/health.test.ts

# Run with coverage
npm run test:coverage
```

## Architecture

```
src/
├── server.ts          # Main Express server
├── lib/
│   ├── env.ts         # Environment validation
│   └── logger.ts      # Structured logging
└── routes/
    ├── health.ts      # Health check endpoints
    └── webhook.ts     # WhatsApp webhook processing
```

## Railway Deployment

This project is configured for Railway deployment with:

- **Automatic builds** on GitHub push
- **Health checks** at `/health`
- **Environment variable validation**
- **Graceful shutdown** handling

### Railway Configuration

The `railway.json` file configures:
- Build process using Nixpacks
- Health check endpoint and timeout
- Restart policy for reliability

## Environment Variables

### Required (All Environments)
- `PORT` - Server port
- `NODE_ENV` - Environment (development/production/test)
- `LOG_LEVEL` - Logging level

### Required (Production Only)
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key
- `GOOGLE_SHEET_ID` - Google Sheets ID
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` - Service account email
- `GOOGLE_PRIVATE_KEY` - Service account private key
- `EVOLUTION_WEBHOOK_SECRET` - Webhook secret
- `TARGET_GROUP_ID` - WhatsApp group ID

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT
