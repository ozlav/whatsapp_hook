# Zehava WhatsApp Webhook Project - Magic Tasks

## Project Overview
WhatsApp webhook processing system that:
1. Listens to EvolutionAPI WhatsApp webhooks
2. Filters messages from specific group (remotejid)
3. Processes unstructured messages via OpenAI LLM using LangGraph
4. Returns structured JSON per schema.json
5. Creates records in Google Sheets

## EPICs
1. **Backend API Foundation** - Core Express server with webhook endpoint
2. **EvolutionAPI Webhook Integration** - Receive and validate WhatsApp webhook payloads
3. **LangGraph + OpenAI Integration** - Process messages through LLM to extract structured data
4. **Google Sheets Integration** - Write structured records to Google Sheets
5. **Database & Persistence (Prisma)** - Store webhook events and processing logs
6. **Configuration & Environment** - Schema validation, env management, and deployment setup

---

## P0: Bootability & Core Infrastructure + Testing

### TASK 1.1: Initialize Express Service + Tests
- **Status**: completed
- **Estimate**: M
- **Labels**: [backend, infra, testing]
- **Rationale**: Foundation for webhook endpoints with Railway-compatible testing
- **Acceptance Criteria**:
  - `npm run dev` starts server on PORT
  - GET /health returns { ok: true }
  - Server binds to Railway-provided PORT
  - Tests pass on Railway CI
  - Health endpoint tested with curl
- **Subtasks**:
  - [ ] Create package.json with scripts (dev/build/start/test)
  - [ ] Setup tsconfig.json (strict mode)
  - [ ] Create src/server.ts with Express app
  - [ ] Add src/routes/health.ts endpoint
  - [ ] Add JSON body parser middleware
  - [ ] Install Jest and testing dependencies
  - [ ] Create tests/health.test.ts with supertest
  - [ ] Add Railway-compatible test script
  - [ ] Test PORT binding with different env values
- **Dependencies**: none
- **File Targets**: 
  - package.json, tsconfig.json, src/server.ts, src/routes/health.ts, tests/health.test.ts, jest.config.js
- **Commands**:
  ```bash
  npm init -y
  npm i express zod dotenv
  npm i -D typescript ts-node-dev @types/node @types/express jest @types/jest supertest @types/supertest ts-jest
  npx tsc --init
  npm run test
  curl http://localhost:$PORT/health
  ```

### TASK 1.2: Environment Validation + Tests
- **Status**: completed
- **Estimate**: M
- **Labels**: [infra, backend, testing]
- **Rationale**: Fail-fast on missing configs with comprehensive validation testing
- **Acceptance Criteria**:
  - App exits with clear error if required env vars missing
  - All secrets validated at startup
  - .env.example documents all required variables
  - Tests verify validation logic
  - Railway CI validates env schema
- **Subtasks**:
  - [ ] Create src/lib/env.ts with zod schema
  - [ ] Validate: DATABASE_URL, OPENAI_API_KEY, GOOGLE_SHEET_ID, EVOLUTION_WEBHOOK_SECRET, TARGET_GROUP_ID
  - [ ] Create .env.example with placeholders
  - [ ] Import and validate in server.ts startup
  - [ ] Create tests/env.test.ts
  - [ ] Test missing env vars throw errors
  - [ ] Test valid env vars pass validation
  - [ ] Test invalid env var formats fail
  - [ ] Add Railway CI env validation step
- **Dependencies**: 1.1
- **File Targets**: src/lib/env.ts, .env.example, tests/env.test.ts
- **Commands**: 
  ```bash
  npm i zod dotenv
  npm run test -- tests/env.test.ts
  unset DATABASE_URL && npm start
  ```

### TASK 2.1: Create Webhook Endpoint + Tests
- **Status**: completed
- **Estimate**: L
- **Labels**: [backend, webhook, testing]
- **Rationale**: Receive EvolutionAPI WhatsApp messages with comprehensive testing
- **Acceptance Criteria**:
  - POST /webhook/whatsapp accepts JSON payload
  - Validates webhook signature/secret
  - Returns 200 OK quickly (async processing)
  - Filters by TARGET_GROUP_ID (remotejid)
  - Tests cover all webhook scenarios
  - Railway CI runs webhook tests
- **Subtasks**:
  - [ ] Create src/routes/webhook.ts
  - [ ] Add POST /webhook/whatsapp handler
  - [ ] Implement signature verification middleware
  - [ ] Filter messages by remotejid
  - [ ] Log received messages
  - [ ] Mount route in server.ts
  - [ ] Create tests/webhook.test.ts
  - [ ] Test valid webhook payload processing
  - [ ] Test invalid signature rejection
  - [ ] Test wrong group ID filtering
  - [ ] Test malformed JSON handling
  - [ ] Test async processing (returns 200 before processing)
  - [ ] Add Railway webhook URL test endpoint
- **Dependencies**: 1.1, 1.2
- **File Targets**: src/routes/webhook.ts, src/middleware/verifyWebhook.ts, tests/webhook.test.ts
- **Commands**: 
  ```bash
  npm run test -- tests/webhook.test.ts
  curl -X POST http://localhost:$PORT/webhook/whatsapp -H "Content-Type: application/json" -d '{"test": "payload"}'
  ```
- **Risk/Unknowns**: EvolutionAPI webhook format unknown; need to check docs for payload structure and signature method

### TASK 1.3: Railway CI/CD Test Pipeline
- **Status**: completed
- **Estimate**: M
- **Labels**: [infra, testing, deployment]
- **Rationale**: Ensure all tests pass on Railway deployment
- **Acceptance Criteria**:
  - Railway runs tests before deployment
  - Health check passes after deployment
  - Webhook endpoint accessible from external sources
  - All P0 functionality verified on Railway
- **Subtasks**:
  - [ ] Create railway.json with test configuration
  - [ ] Add test script to package.json
  - [ ] Configure Railway to run tests on build
  - [ ] Add health check verification step
  - [ ] Test webhook endpoint accessibility
  - [ ] Add Railway deployment status checks
  - [ ] Document Railway test results
- **Dependencies**: 1.1, 1.2, 2.1
- **File Targets**: railway.json, package.json, .github/workflows/railway-test.yml
- **Commands**:
  ```bash
  railway login
  railway link
  railway up --detach
  railway logs
  curl https://your-app.railway.app/health
  ```

### TASK 1.4: Integration Test Suite
- **Status**: completed
- **Estimate**: M
- **Labels**: [testing, integration]
- **Rationale**: End-to-end testing of P0 functionality on Railway
- **Acceptance Criteria**:
  - Full webhook flow tested
  - Environment validation tested
  - Health checks verified
  - Railway-specific configurations tested
- **Subtasks**:
  - [ ] Create tests/integration.test.ts
  - [ ] Test complete webhook processing flow
  - [ ] Test environment variable validation
  - [ ] Test PORT binding on Railway
  - [ ] Test health endpoint under load
  - [ ] Test error handling and logging
  - [ ] Add Railway environment-specific test cases
- **Dependencies**: 1.1, 1.2, 2.1, 1.3
- **File Targets**: tests/integration.test.ts, tests/helpers/testServer.ts
- **Commands**:
  ```bash
  npm run test:integration
  RAILWAY_ENVIRONMENT=production npm run test:integration
  ```

---

## P1: Core Integrations (Planned)

### TASK 5.1: Add Prisma and Connect to Railway DB
- **Status**: planned
- **Estimate**: M
- **Labels**: [db, infra]

### TASK 4.1: Google Sheets Service Account Client
- **Status**: planned
- **Estimate**: M
- **Labels**: [sheets, backend]

### TASK 3.1: Create schema.json for Structured Output
- **Status**: planned
- **Estimate**: S
- **Labels**: [backend, langgraph]

### TASK 3.2: LangGraph + OpenAI Integration
- **Status**: planned
- **Estimate**: L
- **Labels**: [langgraph, backend]

### TASK 2.2: Message Processing Pipeline
- **Status**: planned
- **Estimate**: L
- **Labels**: [backend, integration]

---

## P2: Production Polish (Planned)

### TASK 5.2: Prisma Migration for Deployment
- **Status**: planned
- **Estimate**: S
- **Labels**: [db, infra]

### TASK 6.1: Logging and Monitoring
- **Status**: planned
- **Estimate**: S
- **Labels**: [backend, infra]

### TASK 6.2: Railway Deployment Configuration
- **Status**: planned
- **Estimate**: M
- **Labels**: [infra, docs]

### TASK 6.3: Documentation and README
- **Status**: planned
- **Estimate**: S
- **Labels**: [docs]

---

## Priority Sequence
**P0**: 1.1 → 1.2 → 2.1 → 1.3 → 1.4
**P1**: 5.1, 4.1, 3.1, 3.2, 2.2
**P2**: 5.2, 6.1, 6.2, 6.3

## Total Estimates
- Small (S): 3 tasks (~6h)
- Medium (M): 8 tasks (~32h)  
- Large (L): 3 tasks (~18h)

## Railway Test Coverage
- Unit tests for all P0 components
- Integration tests for webhook flow
- Railway CI/CD pipeline validation
- Health check verification
- Environment validation testing
- External webhook accessibility testing

## Test Commands
```bash
# Local testing
npm run test
npm run test:integration

# Railway deployment testing
railway up --detach
railway logs
curl https://your-app.railway.app/health
curl -X POST https://your-app.railway.app/webhook/whatsapp -H "Content-Type: application/json" -d '{"test": "payload"}'
```
