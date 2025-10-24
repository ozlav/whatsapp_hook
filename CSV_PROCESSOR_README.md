# CSV Message Processor

This tool processes WhatsApp messages from a CSV file and sends them to the webhook endpoint for testing and data replay.

## Files

- `process-csv-messages.js` - JavaScript version (no compilation needed)
- `process-csv-messages.ts` - TypeScript version (requires compilation)
- `zehava 3.csv` - CSV file containing WhatsApp messages

## Installation

Install the required dependencies:

```bash
npm install
```

## Usage

### JavaScript Version (Recommended)

```bash
# Process all messages
node process-csv-messages.js "zehava 3.csv"

# Process with local server
node process-csv-messages.js "zehava 3.csv" local

# Process specific rows (start from row 5, process 10 rows)
node process-csv-messages.js "zehava 3.csv" production 5 10

# Process with custom delay (500ms between requests)
node process-csv-messages.js "zehava 3.csv" production 1 5 500
```

### TypeScript Version

```bash
# Process all messages
npx ts-node process-csv-messages.ts "zehava 3.csv"

# Process with local server
npx ts-node process-csv-messages.ts "zehava 3.csv" local

# Process specific rows
npx ts-node process-csv-messages.ts "zehava 3.csv" production 5 10
```

### Using npm scripts

```bash
# JavaScript version
npm run process-csv -- "zehava 3.csv"

# TypeScript version
npm run process-csv:ts -- "zehava 3.csv"
```

## Parameters

1. **csv_file** (required): Path to CSV file
2. **environment** (optional): `local` or `production` (default: production)
3. **start_row** (optional): Row number to start from (default: 1)
4. **max_rows** (optional): Maximum number of rows to process (default: all)
5. **delay_ms** (optional): Delay between requests in milliseconds (default: 1000)

## CSV Structure

The CSV file should contain the following columns:

- `id`: Unique message ID
- `key`: JSON string with message key data
- `pushName`: Sender display name
- `participant`: Participant ID
- `messageType`: Type of message (conversation, editedMessage, etc.)
- `message`: JSON string with message content
- `contextInfo`: JSON string with context info (for replies)
- `source`: Message source (ios, desktop, etc.)
- `messageTimestamp`: Unix timestamp
- `status`: Message status (READ, DELIVERY_ACK, etc.)
- `instanceId`: WhatsApp instance ID

## Features

- ✅ Processes CSV rows sequentially
- ✅ Handles JSON parsing with escaped quotes
- ✅ Supports different message types (conversation, editedMessage, reactionMessage)
- ✅ Handles reply messages with contextInfo
- ✅ Configurable delay between requests
- ✅ Row range selection (start row, max rows)
- ✅ Error handling and reporting
- ✅ Progress tracking and summary
- ✅ Both local and production environments

## Examples

### Test a few messages locally

```bash
node process-csv-messages.js "zehava 3.csv" local 1 5 2000
```

### Process all messages to production

```bash
node process-csv-messages.js "zehava 3.csv" production
```

### Process messages 10-20 with 500ms delay

```bash
node process-csv-messages.js "zehava 3.csv" production 10 10 500
```

## Output

The script provides detailed output including:

- Processing progress for each row
- Success/failure status for each request
- Final summary with counts
- Error details for failed requests

Example output:
```
🚀 Processing CSV: zehava 3.csv
🌍 Environment: production
🔗 Endpoint: https://whatsapphook-production.up.railway.app/webhook/whatsapp/messages-upsert
⏱️  Delay between requests: 1000ms
📊 Starting from row: 1

📤 Processing row 1 (ID: cmge5qmfy3i3xpb4ldlpfyls5)...
✅ Row cmge5qmfy3i3xpb4ldlpfyls5: Success (HTTP 200)

📊 Processing Summary:
   ✅ Successful: 1
   ❌ Failed: 0
   ⏭️  Skipped: 0
   📈 Total processed: 1
```
