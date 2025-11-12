# Processor Development Guide

This guide explains how to create custom message processors for the WhatsApp webhook system.

## Overview

Processors handle the core logic of message processing. They:
- Analyze WhatsApp messages using LLM
- Extract structured data
- Save to Google Sheets with configurable mappings
- Handle both new messages and replies

## Processor Interface

All processors must implement `IMessageProcessor`:

```typescript
interface IMessageProcessor {
  processFirstMessage(
    payload: ValidatedWebhookPayload,
    messageText: string,
    senderName: string,
    config: Configuration
  ): Promise<ProcessingResult>;

  processReplyMessage(
    payload: ValidatedWebhookPayload,
    messageText: string,
    senderName: string,
    config: Configuration
  ): Promise<ProcessingResult>;

  validateMessage?(
    payload: ValidatedWebhookPayload,
    config: Configuration
  ): Promise<boolean>;
}
```

## Creating a New Processor

### 1. Create Processor Class

Create a new file: `src/lib/processors/implementations/YourProcessor.ts`

```typescript
import { IMessageProcessor } from '../base/IMessageProcessor';
import { Configuration } from '../../config/types';
import { ValidatedWebhookPayload } from '../../validators';
import { ProcessingResult } from '../../../types/webhook';

export class YourProcessor implements IMessageProcessor {
  
  async processFirstMessage(
    payload: ValidatedWebhookPayload,
    messageText: string,
    senderName: string,
    config: Configuration
  ): Promise<ProcessingResult> {
    // Your custom logic here
    // 1. Analyze message with LLM
    // 2. Extract data
    // 3. Save to sheets
    // 4. Return result
  }

  async processReplyMessage(
    payload: ValidatedWebhookPayload,
    messageText: string,
    senderName: string,
    config: Configuration
  ): Promise<ProcessingResult> {
    // Your custom logic here
  }
}
```

### 2. Register Processor

In `src/server.ts`, register your processor:

```typescript
import { YourProcessor } from './lib/processors/implementations/YourProcessor';

// Register on startup
ProcessorFactory.register('YourProcessor', new YourProcessor());
```

### 3. Create Configuration

Use the admin API to create a configuration that uses your processor:

```bash
curl -X POST http://localhost:3000/config \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Your Use Case",
    "enabled": true,
    "groupIds": ["your-group-id@g.us"],
    "processorClass": "YourProcessor",
    "spreadsheetId": "your-spreadsheet-id",
    "mainSheetName": "Data",
    "logSheetName": "Logs",
    "auditSheetName": "Audit",
    "columnMapping": {
      "field1": 0,
      "field2": 1
    }
  }'
```

## Example: Simple Reply Processor

Here's a minimal example:

```typescript
export class SimpleReplyProcessor implements IMessageProcessor {
  
  async processFirstMessage(
    payload: ValidatedWebhookPayload,
    messageText: string,
    senderName: string,
    config: Configuration
  ): Promise<ProcessingResult> {
    try {
      logger.info('Processing first message', { senderName });
      
      // Extract data from message
      const data = await this.extractData(messageText, senderName, config);
      
      // Save to sheets
      await this.saveToSheets(data, config);
      
      return {
        success: true,
        messageType: 'first'
      };
    } catch (error) {
      return {
        success: false,
        messageType: 'ignored',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async processReplyMessage(
    payload: ValidatedWebhookPayload,
    messageText: string,
    senderName: string,
    config: Configuration
  ): Promise<ProcessingResult> {
    // Handle reply messages
    // Similar to processFirstMessage but for replies
  }

  private async extractData(
    messageText: string,
    senderName: string,
    config: Configuration
  ) {
    // Use messageAnalyzer or custom logic
    // Optionally use prompts/schemas from config
  }

  private async saveToSheets(data: any, config: Configuration) {
    // Use sheets operations
    // Use config.columnMapping for mapping
  }
}
```

## Using Configuration

### Accessing Configuration Fields

```typescript
// Access configuration
const spreadsheetId = config.spreadsheetId;
const mainSheet = config.mainSheetName;
const columnMapping = config.columnMapping;

// Access metadata
const requiresWorkId = config.metadata?.requiresWorkId;
```

### Using Dynamic Prompts

```typescript
import { getPromptByType } from '../../prompts/promptService';

// Get custom prompt
const prompt = await getPromptByType(config.id, 'first_message');
if (prompt) {
  // Use custom prompt
  const customTemplate = prompt.template;
}
```

### Using Dynamic Schemas

```typescript
import { getSchemaByConfigId } from '../../schema/schemaService';

// Get custom schema
const schema = await getSchemaByConfigId(config.id);
if (schema) {
  // Use custom schema
  const schemaDefinition = schema.definition;
}
```

## Helper Functions

### Message Analysis

```typescript
import { analyzeMessage } from '../../messageAnalyzer';

// Analyze with custom config
const analysis = await analyzeMessage(
  messageText,
  senderName,
  config.id // Pass config ID for custom prompts/schemas
);
```

### Sheets Operations

```typescript
import { 
  createNewOrder, 
  getSheetRowByWorkId,
  updateSheetRowByIndices 
} from '../../../sheets/operations';

// Create with configuration
await createNewOrder(orderData, fullMessage, config);

// Get row by ID (uses config for sheet names)
const row = await getSheetRowByWorkId(workId);
```

### Column Mapping

```typescript
import { mapDataToColumns, mapColumnsToData } from '../../../sheets/columnMapper';

// Map data to sheet row
const row = mapDataToColumns(orderData, config);

// Map sheet row to data
const data = mapColumnsToData(row, config);
```

## Validation

Implement `validateMessage` to add custom validation:

```typescript
async validateMessage(
  payload: ValidatedWebhookPayload,
  config: Configuration
): Promise<boolean> {
  // Custom validation logic
  const remoteJid = payload.data.key.remoteJid;
  
  // Check group ID is in config
  if (!config.groupIds.includes(remoteJid)) {
    return false;
  }
  
  // Add more validation as needed
  return true;
}
```

## Error Handling

Always return proper `ProcessingResult`:

```typescript
{
  success: boolean;
  messageType: 'first' | 'reply' | 'ignored';
  error?: string;
  analysis?: any;
}
```

Good examples:
- Success: `{ success: true, messageType: 'first' }`
- Failure: `{ success: false, messageType: 'ignored', error: 'reason' }`
- Analysis data: `{ success: true, messageType: 'first', analysis: {...} }`

## Testing

1. Create a test configuration
2. Send test webhooks to your server
3. Check logs for debugging
4. Verify data in sheets

## Best Practices

1. **Use logging**: Log important events and errors
2. **Handle edge cases**: Check for null/undefined values
3. **Return meaningful errors**: Help debug issues
4. **Follow configuration**: Use config for customization
5. **Reuse existing logic**: Leverage helper functions
6. **Be idempotent**: Process same message multiple times safely

## Common Patterns

### Check if Relevant

```typescript
if (!analysis.relevant) {
  return {
    success: true,
    messageType: 'ignored',
    error: 'Message not relevant'
  };
}
```

### Extract Quoted Message

```typescript
const quotedMessageText = extractQuotedMessage(payload);
if (!quotedMessageText) {
  return { success: false, messageType: 'reply', error: 'No quoted message' };
}
```

### Update Sheet Row

```typescript
const row = await getSheetRowByWorkId(workId);
if (!row) {
  return { success: false, messageType: 'reply', error: 'Row not found' };
}

const columnUpdates = { /* updates */ };
await updateSheetRowByIndices(row.rowNumber, columnUpdates);
```

## Next Steps

1. Create your processor class
2. Register in `server.ts`
3. Create configuration via API
4. Test with real messages
5. Monitor logs and adjust

## Need Help?

- Check `src/lib/processors/implementations/WorkOrderProcessor.ts` for reference
- Review existing tests in `tests/`
- Check logs for debugging information


