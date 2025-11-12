# Zehava WhatsApp Message Processing System

## Overview

The Zehava system is a configuration-driven WhatsApp message processing system that listens to webhooks from EvolutionAPI and processes messages from multiple groups using configurable processors, prompts, and spreadsheet integrations.

## Key Features

- **Multi-Group Support**: Process messages from multiple WhatsApp groups with different logic
- **Configuration-Driven**: Manage everything through database configurations and admin API
- **Flexible Processors**: Create custom processors for different use cases
- **Dynamic Prompts**: Customize LLM prompts per configuration
- **Flexible Schema**: Define JSON schemas per configuration
- **Spreadsheet Integration**: Map data to different Google Sheets layouts
- **Admin API**: Manage configurations via REST API

## System Architecture

```
WhatsApp Group → EvolutionAPI → Webhook → Configuration → Processor → Sheets
                       ↓                                          ↓
                   Group ID → Config Lookup              Column Mapping
                                                  ↓
                                            Dynamic Prompts
```

### Components

1. **Configuration System**: Stores configurations in database (Prisma)
2. **Processor Factory**: Registry of processor implementations
3. **Message Analyzer**: LLM-based message analysis with dynamic prompts/schemas
4. **Sheets Operations**: Google Sheets integration with dynamic column mapping
5. **Admin API**: Configuration management endpoints

## Quick Start

### 1. Environment Setup

```bash
# Required environment variables
DATABASE_URL="postgresql://..."
OPENAI_API_KEY="sk-..."
GOOGLE_SHEET_ID="..."
GOOGLE_SERVICE_ACCOUNT_EMAIL="..."
GOOGLE_PRIVATE_KEY="..."
```

### 2. Run Migrations

```bash
npx prisma migrate dev
npx prisma generate
```

### 3. Start Server

```bash
npm run dev
```

The server will automatically create a default configuration from environment variables if no configurations exist.

### 4. Manage Configurations

```bash
# List configurations
curl http://localhost:3000/config

# Create new configuration
curl -X POST http://localhost:3000/config \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Config",
    "enabled": true,
    "groupIds": ["120363420497664775@g.us"],
    "processorClass": "WorkOrderProcessor",
    "spreadsheetId": "abc123...",
    "mainSheetName": "Data",
    "logSheetName": "Logs",
    "auditSheetName": "Audit",
    "columnMapping": { "work_id": 4, "customer_name": 5 }
  }'
```

## Message Processing Flow

### Step 1: Webhook Received

1. EvolutionAPI sends webhook to `/webhook/whatsapp/messages-upsert`
2. System validates payload
3. Extracts group ID (remoteJid)

### Step 2: Configuration Lookup

1. System looks up configuration for group ID
2. If no config found, tries to create default from env vars
3. If still no config, skips processing

### Step 3: Processor Selection

1. Gets processor class from configuration
2. Retrieves processor from factory
3. Delegates to processor

### Step 4: Message Processing

**For new messages:**
1. Extract message text and sender
2. Analyze with LLM using config prompts/schema
3. Extract structured data
4. Save to configured spreadsheet

**For reply messages:**
1. Extract quoted message and reply text
2. Analyze quoted message for work_id
3. Find existing row in spreadsheet
4. Analyze reply for updates
5. Update row with new data

### Step 5: Audit & Logging

1. Log all messages to Log sheet
2. Log audit trail to Audit sheet
3. Return processing result

## Default Configuration (WorkOrderProcessor)

The default processor handles work orders with the following logic:

### Relevance Check

A message is relevant if it contains:
- `work_id` OR `address`
- `address` (required)
- `phone` (required)

### First Messages

- Extract work order data from message
- Create new row in main sheet
- All fields extracted via LLM

### Reply Messages

- Extract work_id from quoted message
- Find existing row by work_id
- Update row with new data from reply
- Append reply to notes column

## Adding New Processors

See [Processor Development Guide](docs/PROCESSOR_DEVELOPMENT.md)

1. Create processor class implementing `IMessageProcessor`
2. Register in `server.ts`
3. Create configuration via admin API
4. Test with real messages

## Configuration Examples

### Work Order Processing

```json
{
  "name": "Work Orders",
  "processorClass": "WorkOrderProcessor",
  "groupIds": ["120363420497664775@g.us"],
  "spreadsheetId": "1abc...",
  "mainSheetName": "Deposite",
  "columnMapping": {
    "work_id": 4,
    "customer_name": 5,
    "address": 6,
    "phone": 7,
    "notes": 12,
    "job_status": 13
  }
}
```

### Custom Use Case

```json
{
  "name": "Customer Service",
  "processorClass": "CustomReplyProcessor",
  "groupIds": ["222xxxxx@g.us"],
  "spreadsheetId": "2def...",
  "mainSheetName": "Tickets",
  "columnMapping": {
    "ticket_id": 0,
    "customer": 1,
    "issue": 2,
    "status": 3
  }
}
```

## API Endpoints

### Health

- `GET /health` - Health check

### Webhooks

- `POST /webhook/whatsapp` - Basic webhook (logs only)
- `POST /webhook/whatsapp/messages-upsert` - Message processing

### Configuration Management

- `GET /config` - List all configurations
- `GET /config/:id` - Get specific configuration
- `POST /config` - Create configuration
- `PUT /config/:id` - Update configuration
- `DELETE /config/:id` - Delete configuration

### Graph

- `POST /graph/run` - Run LangGraph workflow (legacy)

## Documentation

- [Configuration Guide](docs/CONFIGURATION_GUIDE.md) - How to create and manage configurations
- [Processor Development](docs/PROCESSOR_DEVELOPMENT.md) - How to create custom processors
- [Original Overview](overview.md) - Detailed message processing logic

## Development

### Project Structure

```
src/
  lib/
    config/        # Configuration management
    processors/    # Processor implementations
    prompts/       # Prompt management
    schema/        # Schema management
  routes/          # API routes
  sheets/          # Google Sheets operations
  graph/           # Message processing pipeline
  db/              # Database client
tests/
  integration/     # Integration tests
```

### Adding Features

1. Create processor in `src/lib/processors/implementations/`
2. Register in `src/server.ts`
3. Create configuration via API
4. Test with real messages
5. Monitor logs

## Deployment

The system is deployed to Railway with:
- Automatic migrations on deploy
- Environment variable configuration
- Database-backed configurations
- Health check monitoring
