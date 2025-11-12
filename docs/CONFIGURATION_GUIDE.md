# Configuration Guide

This guide explains how to create and manage message processing configurations for the WhatsApp webhook system.

## Overview

The system now supports multiple WhatsApp groups with different processing logic, prompts, schemas, and spreadsheets. Each configuration defines:

- Which groups to listen to
- Which processor class to use
- Which spreadsheet and sheets to write to
- Column mappings for data
- Prompts for LLM analysis
- JSON schemas for validation

## Configuration Structure

### Required Fields

```typescript
{
  name: string;              // Human-readable name
  enabled: boolean;          // Whether this config is active
  groupIds: string[];       // WhatsApp group IDs to listen to
  processorClass: string;   // Processor class name (e.g., "WorkOrderProcessor")
  spreadsheetId: string;    // Google Sheets ID
  mainSheetName: string;    // Name of main data sheet
  logSheetName: string;     // Name of log sheet
  auditSheetName: string;   // Name of audit sheet
  columnMapping: {          // Column index mappings (0-based)
    field_name: number;
    // ...
  }
}
```

### Optional Fields

```typescript
{
  metadata?: {              // Additional metadata
    requiresWorkId?: boolean;
    allowUpdates?: boolean;
    // ... custom fields
  }
}
```

## Creating Configurations

### Via Admin API

```bash
# Create a new configuration
curl -X POST http://localhost:3000/config \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Main Work Orders",
    "enabled": true,
    "groupIds": ["120363420497664775@g.us"],
    "processorClass": "WorkOrderProcessor",
    "spreadsheetId": "abc123...",
    "mainSheetName": "Deposite",
    "logSheetName": "Logs",
    "auditSheetName": "AuditLog",
    "columnMapping": {
      "work_id": 4,
      "customer_name": 5,
      "address": 6
    }
  }'
```

### Column Mapping

The `columnMapping` field maps field names to sheet column indices (0-based):

```json
{
  "work_id": 4,      // Column E (0-based index 4)
  "customer_name": 5, // Column F
  "address": 6,      // Column G
  "phone": 7,        // Column H
  "notes": 12,       // Column M
  "job_status": 13   // Column N
}
```

**Important**: Make sure your column mappings match your actual spreadsheet structure.

## Managing Prompts

### Adding Prompts

```bash
# Add a prompt for a configuration
curl -X POST http://localhost:3000/config/:id/prompts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "first_message",
    "type": "first_message",
    "template": "You are analyzing a WhatsApp message...",
    "systemPrompt": "You are a helpful assistant."
  }'
```

### Prompt Types

- `first_message`: Prompt for analyzing new messages
- `reply_analysis`: Prompt for analyzing reply messages

### Prompt Templates

Prompts support variable substitution using `{{variable}}` syntax:

```
Message from {{senderName}}: "{{messageText}}"

Extract the following fields...
```

## Managing Schemas

### Adding Schemas

```bash
# Add a schema for a configuration
curl -X POST http://localhost:3000/config/:id/schema \
  -H "Content-Type: application/json" \
  -d '{
    "definition": {
      "title": "Payment and Job Data",
      "type": "object",
      "properties": {
        "work_id": { "type": "string" },
        "address": { "type": "string" }
      }
    }
  }'
```

## Example Configuration

### Work Order Processing

```json
{
  "name": "Main Work Orders",
  "enabled": true,
  "groupIds": ["120363420497664775@g.us"],
  "processorClass": "WorkOrderProcessor",
  "spreadsheetId": "1abc123...",
  "mainSheetName": "Deposite",
  "logSheetName": "Logs",
  "auditSheetName": "AuditLog",
  "columnMapping": {
    "work_id": 4,
    "customer_name": 5,
    "address": 6,
    "phone": 7,
    "job_description": 0,
    "total_price": 10,
    "deposit": 9,
    "job_status": 13,
    "notes": 12
  },
  "metadata": {
    "requiresWorkId": true,
    "allowUpdates": true
  }
}
```

## API Endpoints

- `GET /config` - List all configurations
- `GET /config/:id` - Get specific configuration
- `POST /config` - Create new configuration
- `PUT /config/:id` - Update configuration
- `DELETE /config/:id` - Delete configuration

## Migration from Environment Variables

The system automatically creates a default configuration from environment variables on first run (if database is available). You can also do this manually:

1. Ensure `DATABASE_URL` is set
2. Server will auto-create config from env vars on first boot
3. Update via API as needed

## Tips

1. **Test with small spreadsheets first** before applying to production data
2. **Verify column mappings** match your sheet structure exactly
3. **Use descriptive names** for configurations
4. **Enable/disable** configurations instead of deleting them
5. **Monitor logs** to debug configuration issues

## Troubleshooting

### Configuration Not Found

If messages aren't being processed:

1. Check that configuration `enabled` is `true`
2. Verify `groupIds` include the correct WhatsApp group ID
3. Ensure `processorClass` is registered in the system

### Wrong Data in Sheets

If data appears in wrong columns:

1. Verify `columnMapping` indices match your sheet
2. Check that sheet has headers in expected positions
3. Use `GET /config/:id` to verify mapping

### Prompts Not Loading

If custom prompts aren't being used:

1. Verify prompts are created with correct `configurationId`
2. Check prompt `type` matches expected values
3. Review logs for prompt loading errors


