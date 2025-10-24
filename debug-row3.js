#!/usr/bin/env node

/**
 * Debug script to investigate row 3 failure
 */

const fs = require('fs');
const csv = require('csv-parser');
const axios = require('axios');

class DebugProcessor {
  constructor() {
    this.url = 'http://localhost:3000/webhook/whatsapp/messages-upsert';
  }

  parseJsonField(jsonStr) {
    if (!jsonStr || jsonStr.trim() === '') {
      return {};
    }
    
    try {
      const cleanedJson = jsonStr.replace(/""/g, '"');
      return JSON.parse(cleanedJson);
    } catch (error) {
      console.warn(`⚠️  JSON parsing error: ${error.message}`);
      return {};
    }
  }

  buildPayload(row) {
    try {
      const keyData = this.parseJsonField(row.key);
      const messageData = this.parseJsonField(row.message);
      const contextInfo = this.parseJsonField(row.contextInfo);
      
      let messageTimestamp = parseInt(row.messageTimestamp);
      if (isNaN(messageTimestamp) || messageTimestamp === 0) {
        messageTimestamp = Math.floor(Date.now() / 1000);
      }
      
      const payload = {
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
        destination: 'https://whatsapphook-production.up.railway.app/webhook/whatsapp',
        sender: '972542233372@s.whatsapp.net',
        server_url: 'https://evolution-api-production-0925.up.railway.app',
        apikey: '58B5BE930282-49B3-947C-1C68049AFE5E'
      };
      
      if (contextInfo && Object.keys(contextInfo).length > 0) {
        payload.data.contextInfo = contextInfo;
      }
      
      const dt = new Date(messageTimestamp * 1000);
      payload.date_time = dt.toISOString();
      
      return payload;
      
    } catch (error) {
      console.error(`❌ Error building payload: ${error.message}`);
      return null;
    }
  }

  async debugRow3() {
    console.log('🔍 Debugging row 3...\n');
    
    return new Promise((resolve, reject) => {
      let rowCount = 0;
      
      fs.createReadStream('zehava 3.csv')
        .pipe(csv())
        .on('data', async (row) => {
          rowCount++;
          
          if (rowCount === 3) {
            console.log('📋 Row 3 data:');
            console.log(`   ID: ${row.id}`);
            console.log(`   Message Type: ${row.messageType}`);
            console.log(`   Push Name: ${row.pushName}`);
            console.log(`   Status: ${row.status}`);
            console.log();
            
            console.log('🔧 Parsed JSON fields:');
            const keyData = this.parseJsonField(row.key);
            const messageData = this.parseJsonField(row.message);
            const contextInfo = this.parseJsonField(row.contextInfo);
            
            console.log('   Key data:', JSON.stringify(keyData, null, 2));
            console.log();
            console.log('   Message data:', JSON.stringify(messageData, null, 2));
            console.log();
            console.log('   Context info:', JSON.stringify(contextInfo, null, 2));
            console.log();
            
            console.log('📦 Generated payload:');
            const payload = this.buildPayload(row);
            if (payload) {
              console.log(JSON.stringify(payload, null, 2));
              console.log();
              
              console.log('🚀 Sending to server...');
              try {
                const headers = {
                  'Content-Type': 'application/json',
                  'x-request-id': `debug-row3-${Date.now()}`,
                  'User-Agent': 'Debug-Script/1.0'
                };
                
                const response = await axios.post(this.url, payload, { headers, timeout: 30000 });
                console.log(`✅ Success! HTTP ${response.status}`);
                console.log('Response:', JSON.stringify(response.data, null, 2));
                
              } catch (error) {
                console.log(`❌ Error: ${error.message}`);
                if (error.response) {
                  console.log(`   Status: ${error.response.status}`);
                  console.log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
                }
              }
            }
            
            resolve();
          }
        })
        .on('error', reject);
    });
  }
}

async function main() {
  const debugProcessor = new DebugProcessor();
  await debugProcessor.debugRow3();
}

main().catch(console.error);
