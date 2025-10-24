#!/usr/bin/env node

/**
 * CSV Message Processor for WhatsApp Webhook
 * Processes messages from zehava 3.csv and sends them to the webhook endpoint
 */

import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parser';
import axios, { AxiosResponse } from 'axios';

interface WebhookPayload {
  event: string;
  instance: string;
  data: {
    key: {
      id: string;
      fromMe: boolean;
      remoteJid: string;
      participant: string;
    };
    pushName: string;
    status: string;
    message: {
      conversation?: string;
      editedMessage?: any;
      reactionMessage?: any;
      messageContextInfo?: {
        messageSecret: string;
        deviceListMetadata?: any;
        deviceListMetadataVersion?: number;
        senderKeyDistributionMessage?: any;
      };
    };
    messageType: string;
    messageTimestamp: number;
    instanceId: string;
    source: string;
    contextInfo?: {
      stanzaId?: string;
      participant?: string;
      quotedMessage?: {
        conversation: string;
      };
      expiration?: number;
      mentionedJid?: string[];
      pairedMediaType?: string;
    };
  };
  destination: string;
  date_time: string;
  sender: string;
  server_url: string;
  apikey: string;
}

interface CsvRow {
  id: string;
  key: string;
  pushName: string;
  participant: string;
  messageType: string;
  message: string;
  contextInfo: string;
  source: string;
  messageTimestamp: string;
  chatwootMessageId: string;
  chatwootInboxId: string;
  chatwootConversationId: string;
  chatwootContactInboxSourceId: string;
  chatwootIsRead: string;
  instanceId: string;
  webhookUrl: string;
  sessionId: string;
  status: string;
}

class MessageProcessor {
  private environment: string;
  private delay: number;
  private url: string;
  private webhookMetadata: Partial<WebhookPayload>;

  constructor(environment: string = 'production', delay: number = 1000) {
    this.environment = environment;
    this.delay = delay;
    
    if (environment === 'local') {
      this.url = 'http://localhost:3000/webhook/whatsapp/messages-upsert';
    } else {
      this.url = 'https://whatsapphook-production.up.railway.app/webhook/whatsapp/messages-upsert';
    }
    
    this.webhookMetadata = {
      destination: 'https://whatsapphook-production.up.railway.app/webhook/whatsapp',
      sender: '972542233372@s.whatsapp.net',
      server_url: 'https://evolution-api-production-0925.up.railway.app',
      apikey: '58B5BE930282-49B3-947C-1C68049AFE5E'
    };
  }

  private parseJsonField(jsonStr: string): any {
    if (!jsonStr || jsonStr.trim() === '') {
      return {};
    }
    
    try {
      // Replace escaped quotes with regular quotes for proper JSON parsing
      const cleanedJson = jsonStr.replace(/""/g, '"');
      return JSON.parse(cleanedJson);
    } catch (error) {
      console.warn(`⚠️  JSON parsing error: ${error}`);
      console.warn(`   Raw string: ${jsonStr.substring(0, 100)}...`);
      return {};
    }
  }

  private buildPayload(row: CsvRow): WebhookPayload | null {
    try {
      // Parse JSON fields
      const keyData = this.parseJsonField(row.key);
      const messageData = this.parseJsonField(row.message);
      const contextInfo = this.parseJsonField(row.contextInfo);
      
      // Skip empty rows
      if (!keyData || !messageData) {
        return null;
      }
      
      // Extract basic fields
      let messageTimestamp = parseInt(row.messageTimestamp);
      if (isNaN(messageTimestamp) || messageTimestamp === 0) {
        messageTimestamp = Math.floor(Date.now() / 1000);
      }
      
      // Build the payload structure
      const payload: WebhookPayload = {
        event: 'messages.upsert',
        instance: 'My Phone',
        data: {
          key: keyData,
          pushName: row.pushName || 'Unknown',
          status: row.status || 'READ',
          message: messageData,
          messageType: row.messageType || 'conversation',
          messageTimestamp: messageTimestamp,
          instanceId: row.instanceId || '97d240ed-9e1e-49e3-aad0-80fc74d18d33',
          source: row.source || 'unknown'
        },
        ...this.webhookMetadata
      } as WebhookPayload;
      
      // Add contextInfo if present (for reply messages)
      if (contextInfo && Object.keys(contextInfo).length > 0) {
        payload.data.contextInfo = contextInfo;
      }
      
      // Add date_time
      const dt = new Date(messageTimestamp * 1000);
      payload.date_time = dt.toISOString();
      
      return payload;
      
    } catch (error) {
      console.error(`❌ Error building payload for row ${row.id}: ${error}`);
      return null;
    }
  }

  private async sendMessage(payload: WebhookPayload, rowId: string): Promise<boolean> {
    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-request-id': `csv-${rowId}-${Date.now()}`,
        'User-Agent': 'CSV-Processor/1.0'
      };
      
      const response: AxiosResponse = await axios.post(
        this.url,
        payload,
        { headers, timeout: 30000 }
      );
      
      if (response.status === 200) {
        console.log(`✅ Row ${rowId}: Success (HTTP ${response.status})`);
        return true;
      } else {
        console.log(`❌ Row ${rowId}: Failed (HTTP ${response.status})`);
        console.log(`   Response: ${JSON.stringify(response.data).substring(0, 200)}...`);
        return false;
      }
      
    } catch (error: any) {
      console.error(`❌ Row ${rowId}: Network error - ${error.message}`);
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async processCsv(
    csvFile: string, 
    startRow: number = 1, 
    maxRows?: number
  ): Promise<void> {
    console.log(`🚀 Processing CSV: ${csvFile}`);
    console.log(`🌍 Environment: ${this.environment}`);
    console.log(`🔗 Endpoint: ${this.url}`);
    console.log(`⏱️  Delay between requests: ${this.delay}ms`);
    console.log(`📊 Starting from row: ${startRow}`);
    if (maxRows) {
      console.log(`📊 Max rows to process: ${maxRows}`);
    }
    console.log();
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    let currentRow = 0;
    
    return new Promise((resolve, reject) => {
      const rows: CsvRow[] = [];
      
      fs.createReadStream(csvFile)
        .pipe(csv())
        .on('data', (row: CsvRow) => {
          rows.push(row);
        })
        .on('end', async () => {
          try {
            for (let i = 0; i < rows.length; i++) {
              currentRow = i + 1;
              
              // Skip rows before startRow
              if (currentRow < startRow) {
                continue;
              }
              
              // Check maxRows limit
              if (maxRows && (currentRow - startRow + 1) > maxRows) {
                break;
              }
              
              const row = rows[i];
              const rowId = row.id || `row_${currentRow}`;
              console.log(`📤 Processing row ${currentRow} (ID: ${rowId})...`);
              
              // Build payload
              const payload = this.buildPayload(row);
              if (!payload) {
                console.log(`⏭️  Skipping row ${currentRow} - empty or invalid data`);
                skippedCount++;
                continue;
              }
              
              // Send message
              const success = await this.sendMessage(payload, rowId);
              if (success) {
                successCount++;
              } else {
                errorCount++;
              }
              
              // Delay between requests (except for the last one)
              if (i < rows.length - 1) {
                await this.sleep(this.delay);
              }
            }
            
            console.log();
            console.log('📊 Processing Summary:');
            console.log(`   ✅ Successful: ${successCount}`);
            console.log(`   ❌ Failed: ${errorCount}`);
            console.log(`   ⏭️  Skipped: ${skippedCount}`);
            console.log(`   📈 Total processed: ${successCount + errorCount + skippedCount}`);
            
            resolve();
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error) => {
          console.error(`❌ Error reading CSV file: ${error}`);
          reject(error);
        });
    });
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: npx ts-node process-csv-messages.ts <csv_file> [environment] [start_row] [max_rows] [delay_ms]');
    console.log('  csv_file: Path to CSV file (e.g., "zehava 3.csv")');
    console.log('  environment: local or production (default: production)');
    console.log('  start_row: Row number to start from (default: 1)');
    console.log('  max_rows: Maximum number of rows to process (default: all)');
    console.log('  delay_ms: Delay between requests in milliseconds (default: 1000)');
    console.log();
    console.log('Examples:');
    console.log('  npx ts-node process-csv-messages.ts "zehava 3.csv"');
    console.log('  npx ts-node process-csv-messages.ts "zehava 3.csv" local');
    console.log('  npx ts-node process-csv-messages.ts "zehava 3.csv" production 5 10');
    console.log('  npx ts-node process-csv-messages.ts "zehava 3.csv" production 1 5 500');
    process.exit(1);
  }
  
  const csvFile = args[0];
  const environment = args[1] || 'production';
  const startRow = parseInt(args[2]) || 1;
  const maxRows = args[3] ? parseInt(args[3]) : undefined;
  const delay = parseInt(args[4]) || 1000;
  
  // Check if CSV file exists
  if (!fs.existsSync(csvFile)) {
    console.error(`❌ Error: CSV file '${csvFile}' not found`);
    process.exit(1);
  }
  
  const processor = new MessageProcessor(environment, delay);
  
  try {
    await processor.processCsv(csvFile, startRow, maxRows);
  } catch (error) {
    console.error(`❌ Error processing CSV: ${error}`);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { MessageProcessor, WebhookPayload, CsvRow };
