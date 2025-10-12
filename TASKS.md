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
- **Status**: completed
- **Estimate**: M
- **Labels**: [db, infra]
- **Rationale**: Database client with Prisma for webhook logging and data persistence
- **Acceptance Criteria**:
  - Prisma client compiles and connects to Railway DB
  - Graceful handling when DATABASE_URL not set
  - Database operations work in production
- **Subtasks**:
  - [x] Add prisma & @prisma/client; npx prisma init
  - [x] prisma/schema.prisma set to postgresql + env("DATABASE_URL")
  - [x] src/db/client.ts singleton with connection testing
  - [x] Graceful handling when DATABASE_URL not available
  - [x] Add database connection validation
- **Dependencies**: 1.1, 1.2
- **File Targets**: prisma/schema.prisma, src/db/client.ts
- **Commands**:
  ```bash
  npm i -D prisma && npm i @prisma/client
  npx prisma generate
  npx prisma migrate dev
  ```

### TASK 4.1: Google Sheets Service Account Client
- **Status**: completed
- **Estimate**: M
- **Labels**: [sheets, backend]
- **Rationale**: Google Sheets integration for storing structured work order data
- **Acceptance Criteria**:
  - Service account authentication works
  - Can append data to Google Sheets
  - Can read data from Google Sheets
  - Can create new sheets
  - Connection testing available
- **Subtasks**:
  - [x] Create src/sheets/client.ts with JWT + scope
  - [x] Helper functions: appendToSheet, getSheetData, createSheet
  - [x] Service account authentication with googleapis
  - [x] Error handling and logging
  - [x] Connection testing function
- **Dependencies**: 1.1, 1.2
- **File Targets**: src/sheets/client.ts
- **Commands**:
  ```bash
  npm i googleapis
  # Test with real credentials
  npm run dev:test-sheets
  ```

### TASK 3.1: Update schema.json for Work Order Fields
- **Status**: completed
- **Estimate**: S
- **Labels**: [backend, langgraph]
- **Rationale**: Schema needs to include work_id and phone fields as minimum required fields per overview.md logic
- **Acceptance Criteria**:
  - Schema includes work_id, address, phone as minimum required fields
  - LLM can extract work_id from messages
  - Relevance checking uses LLM analysis and relevant column
  - Tests verify work_id extraction from various message formats
- **Subtasks**:
  - [x] Update schema.json to add work_id and phone fields
  - [x] Make work_id, address, phone required fields (minimum for relevance)
  - [x] Update LLM prompt to extract work_id from messages
  - [x] Test work_id extraction with sample messages
  - [x] Update relevance checking logic to use LLM relevant column
- **Dependencies**: none
- **File Targets**: schema.json, src/graph/index.ts
- **Commands**:
  ```bash
  # Test schema validation
  npm run test -- schema-validation
  ```

### TASK 3.2: LangGraph + OpenAI Integration
- **Status**: completed
- **Estimate**: L
- **Labels**: [langgraph, backend]
- **Rationale**: LLM processing of WhatsApp messages to extract structured data
- **Acceptance Criteria**:
  - OpenAI client configured with proper model settings
  - Message processing pipeline works
  - Schema-based extraction implemented
  - Error handling and fallback logic in place
- **Subtasks**:
  - [x] Create src/graph/index.ts with OpenAI integration
  - [x] Message text extraction from WhatsApp payloads
  - [x] Schema-based prompt generation
  - [x] JSON response parsing with fallback
  - [x] Error handling and logging
- **Dependencies**: 1.1, 1.2, 3.1
- **File Targets**: src/graph/index.ts, src/lib/schemaLoader.ts
- **Commands**:
  ```bash
  npm i @langchain/langgraph @langchain/openai
  # Test with real API key
  npm run dev:test-llm
  ```

### TASK 2.2: Message Processing Pipeline
- **Status**: cancelled
- **Estimate**: L
- **Labels**: [backend, integration]
- **Rationale**: Superseded by P1.5 tasks which provide more comprehensive message processing with threading support
- **Note**: This task is redundant with P1.5 tasks 2.3-2.6 which provide better functionality

---

## P1.5: WhatsApp Message Threading & Reply Handling (New)

### TASK 2.3: Thread Extraction & Reply Detection
- **Status**: planned
- **Estimate**: M
- **Labels**: [backend, whatsapp, db]
- **Rationale**: Detect reply messages and extract complete thread history using getThread.sql query
- **Acceptance Criteria**:
  - Detect if incoming message is a reply (has `contextInfo.stanzaId` field)
  - Extract complete thread history using getThread.sql query
  - Return structured thread data for analysis
  - Tests verify reply detection and thread extraction
- **Subtasks**:
  - [ ] Research EvolutionAPI reply message structure (`contextInfo.stanzaId` field)
  - [ ] Create `src/lib/messageParser.ts` with functions:
    - `isReplyMessage(payload): boolean` (checks for contextInfo.stanzaId)
    - `extractQuotedMessageId(payload): string | null` (gets parent message ID)
  - [ ] Create `src/db/queries/threadQueries.ts` with getThread.sql implementation:
    - `getThreadHistory(messageId): Promise<ThreadMessage[]>`
  - [ ] Add unit tests for reply detection and thread extraction
  - [ ] Test with real EvolutionAPI reply payloads
- **Dependencies**: 5.1 (Prisma DB setup)
- **File Targets**: 
  - src/lib/messageParser.ts
  - src/db/queries/threadQueries.ts
  - tests/messageParser.test.ts
- **Commands**:
  ```bash
  npm run test -- tests/messageParser.test.ts
  # Test thread query
  npm run test -- tests/threadQueries.test.ts
  ```
- **Risk/Unknowns**: 
  - Need to confirm exact EvolutionAPI reply message structure
  - Mitigation: Review EvolutionAPI docs and capture real reply payloads for testing

### TASK 2.4: Simplified Message Analysis (2 LLM Calls Only)
- **Status**: planned
- **Estimate**: M
- **Labels**: [backend, ai, whatsapp]
- **Rationale**: Simplified analysis with only 2 LLM calls: first message analysis and reply analysis
- **Acceptance Criteria**:
  - **First Message Analysis**: Extract all fields + relevance check in single LLM call
  - **Reply Analysis**: Check work_id + detect changes in single LLM call
  - Performance: each analysis completes in <2 seconds
  - Tests verify correct work order detection and change analysis for both scenarios
- **Subtasks**:
  - [ ] Create `src/lib/messageAnalyzer.ts` with functions:
    - `analyzeFirstMessage(message): Promise<FirstMessageAnalysis>` - extracts all fields + relevance
    - `analyzeReplyMessage(message, threadHistory): Promise<ReplyAnalysis>` - checks work_id + changes
  - [ ] Create LangGraph nodes for analysis:
    - `firstMessageAnalyzer` - single LLM call: extract all fields + relevance (work_id, address, phone)
    - `replyMessageAnalyzer` - single LLM call: check work_id exists + detect what changed
  - [ ] Write optimized system prompts:
    - **First message prompt**: "Extract all work order fields from this message. Return JSON with: work_id, address, phone, customer_name, job_description, total_price, deposit, job_status, start_date_time, notes, and relevance (true/false if has work_id, address, phone)"
    - **Reply prompt**: "Given this thread history, does it contain a work order with work_id? What specific fields changed in the last message? Return JSON with: hasWorkId (boolean), workId (string), changesDetected (boolean), changedFields (array)"
  - [ ] Create test cases for both scenarios:
    - **First messages**: complete field extraction + relevance check
    - **Reply messages**: work_id detection + change detection in single call
  - [ ] Add integration tests with OpenAI API for both scenarios
  - [ ] Test edge cases: very long threads, ambiguous changes, malformed messages
- **Dependencies**: 2.3 (Thread extraction), 3.2 (LangGraph base)
- **File Targets**:
  - src/lib/messageAnalyzer.ts
  - src/graph/nodes/firstMessageAnalyzer.ts
  - src/graph/nodes/replyMessageAnalyzer.ts
  - tests/messageAnalyzer.test.ts
- **Commands**:
  ```bash
  npm run test -- tests/messageAnalyzer.test.ts
  # Test with real message examples
  npm run dev:test-message-analysis
  ```
- **Risk/Unknowns**:
  - Single LLM call might miss some fields or changes
  - Mitigation: Use detailed prompts and test with various message patterns

### TASK 2.5: Google Sheets Operations (Create + Update)
- **Status**: planned
- **Estimate**: M
- **Labels**: [sheets, backend]
- **Rationale**: Handle both new work order creation and updates to existing orders in Google Sheets
- **Acceptance Criteria**:
  - **New Orders**: Create new sheet row for first messages with work order data
  - **Updates**: Find existing row by work_id and update specific columns for reply messages
  - Preserve other column values during partial updates
  - Log all operations with timestamp and reason
  - Handle edge cases: row not found, multiple matches, failed operations
  - Tests verify correct row creation and updates
- **Subtasks**:
  - [ ] Create `src/sheets/operations.ts` with functions:
    - `createNewOrder(orderData: OrderData): Promise<number>` - creates new row
    - `findSheetRowByWorkId(workId: string): Promise<number | null>` - finds existing row
    - `updateSheetRow(rowNumber: number, updates: Partial<OrderData>): Promise<void>` - updates existing row
    - `appendUpdateLog(workId: string, changes: ChangeAnalysis): Promise<void>` - audit trail
  - [ ] Implement new order creation:
    - Map FirstMessageAnalysis to OrderData format
    - Append new row to main sheet
    - Generate unique row ID for tracking
    - Log creation in audit sheet
  - [ ] Implement row search logic for updates:
    - Try by work_id first (primary key from thread analysis)
    - Fallback to customer_name + start_date_time match
    - Handle multiple matches with warning
  - [ ] Create update operations for different change types from ChangeAnalysis:
    - Status updates (job_status: "done", "refund", "cancelled")
    - Price updates (total_price, deposit)
    - Note updates (append to notes field)
    - Address updates (address field)
    - Customer info updates (customer_name, phone)
  - [ ] Add audit trail in separate "Updates" sheet with:
    - work_id, timestamp, operation_type (create/update), change_type, old_value, new_value, reason
  - [ ] Create tests with mock Google Sheets API
  - [ ] Test edge cases: row not found, multiple matches, failed operations
  - [ ] Add retry logic for transient Sheets API errors
  - [ ] Handle concurrent operations (check row version or timestamp)
- **Dependencies**: 2.4 (Simplified analysis), 4.1 (Google Sheets client)
- **File Targets**:
  - src/sheets/operations.ts
  - src/sheets/client.ts
  - tests/sheetsOperations.test.ts
- **Commands**:
  ```bash
  npm run test -- tests/sheetsOperations.test.ts
  # Test with real Sheets
  npm run dev:test-sheets-operations
  ```
- **Risk/Unknowns**:
  - Multiple rows might match search criteria (duplicate work_ids)
  - Mitigation: Use work_id as primary key; warn on ambiguous matches

### TASK 2.6: Simplified Message Processing Orchestration
- **Status**: planned
- **Estimate**: L
- **Labels**: [backend, integration, testing]
- **Rationale**: Orchestrate simplified message processing flow with only 2 LLM calls maximum
- **Acceptance Criteria**:
  - Step 1: Check if message is reply (contextInfo.stanzaId)
  - Step 2: First Message Handling - analyze directly using TASK 2.4 (single LLM call)
  - Step 3: Reply Message Handling - extract thread → analyze reply using TASK 2.4 (single LLM call)
  - Step 4: Irrelevant Message Handling - if no work order info, ignore message
  - Error handling for each step with proper logging
  - Comprehensive integration tests cover full scenarios
  - Performance: end-to-end processing <5 seconds
- **Subtasks**:
  - [ ] Create `src/lib/messageProcessor.ts` orchestrator:
    - `isReplyMessage(message)` → check contextInfo.stanzaId
    - `handleFirstMessage(message)` → TASK 2.4 (first message analysis) → TASK 2.5 (if relevant)
    - `handleReplyMessage(message)` → TASK 2.3 → TASK 2.4 (reply analysis) → TASK 2.5 (if changes)
    - `ignoreMessage(message)` → log and skip
  - [ ] Update webhook handler to use messageProcessor:
    - Route messages based on reply status
    - Handle first message processing flow (1 LLM call)
    - Handle reply processing flow (1 LLM call)
    - Handle error cases and logging
  - [ ] Add error handling and rollback mechanisms:
    - If thread extraction fails → log error and ignore
    - If analysis fails → log error and ignore
    - If update fails → log error and flag for manual review
  - [ ] Implement idempotency: don't process same message twice
  - [ ] Create comprehensive integration tests:
    - Test 1: First message with work order → creates new order (1 LLM call)
    - Test 2: First message without work order → ignored (1 LLM call)
    - Test 3: Reply with work order + changes → extract thread + analyze + update (1 LLM call)
    - Test 4: Reply without work order in thread → extract thread + analyze + ignore (1 LLM call)
    - Test 5: Reply with work order but no changes → extract thread + analyze + ignore (1 LLM call)
    - Test 6: Multiple replies on same work order
  - [ ] Add monitoring and alerting for pipeline failures
  - [ ] Document simplified message processing flow in README
- **Dependencies**: 2.3 (Thread extraction), 2.4 (Simplified analysis), 2.5 (Sheets updates)
- **File Targets**:
  - src/lib/messageProcessor.ts
  - src/routes/webhook.ts
  - tests/integration/messagePipeline.test.ts
  - README.md
- **Commands**:
  ```bash
  npm run test:integration -- message-pipeline
  # Test with example payloads
  ./test-webhook-replies.sh
  ```
- **Risk/Unknowns**:
  - Single LLM call per message type may miss edge cases
  - Mitigation: Extensive testing with real-world message patterns; manual review queue for failures

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
**P0**: 1.1 → 1.2 → 2.1 → 1.3 → 1.4 (COMPLETED)
**P1**: 5.1, 4.1, 3.1, 3.2 (COMPLETED) + 2.2 (CANCELLED - superseded by P1.5)
**P1.5**: 2.3 → 2.4 → 2.5 → 2.6 (NEW: Threading & Reply Handling)
**P2**: 5.2, 6.1, 6.2, 6.3

## Simplified Message Processing Flow (2 LLM Calls Maximum)
```
Incoming Message
    ↓
[Is Reply?] → contextInfo.stanzaId
    ↓ NO                                    ↓ YES
[First Message Analysis]                [Extract Thread] → getThread.sql
    ↓ (1 LLM call)                          ↓
[Extract all fields + relevance]        [Thread History Retrieved]
    ↓                                        ↓
[Has work_id, address, phone?]          [Reply Analysis] → (1 LLM call)
    ↓ YES              ↓ NO                  ↓
[Create Sheet Row]    [Ignore]          [Has work_id + changes?]
    ↓                                      ↓ YES              ↓ NO
[Log Success]                            [Update Row]      [Ignore]
                                            ↓
                                        [Log Update]
```

## Total Estimates
- Small (S): 3 tasks (~6h)
- Medium (M): 10 tasks (~40h) [+2 new threading tasks]
- Large (L): 4 tasks (~24h) [+1 new threading task]
- **New Threading Feature Total**: ~16-20h (M+M+M+L)

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
