#!/usr/bin/env node

/**
 * Simple deployment test script
 * Usage: node test-deployment.js <railway-url>
 */

const https = require('https');
const http = require('http');

const url = process.argv[2];

if (!url) {
  console.error('Usage: node test-deployment.js <railway-url>');
  console.error('Example: node test-deployment.js https://your-app.railway.app');
  process.exit(1);
}

const baseUrl = url.replace(/\/$/, ''); // Remove trailing slash

console.log(`🧪 Testing deployment at: ${baseUrl}`);

// Test health endpoint
function testHealth() {
  return new Promise((resolve, reject) => {
    const client = baseUrl.startsWith('https') ? https : http;
    
    client.get(`${baseUrl}/health`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.ok) {
            console.log('✅ Health check passed');
            resolve(true);
          } else {
            console.log('❌ Health check failed:', response);
            resolve(false);
          }
        } catch (e) {
          console.log('❌ Health check failed - invalid JSON:', data);
          resolve(false);
        }
      });
    }).on('error', (err) => {
      console.log('❌ Health check failed - network error:', err.message);
      resolve(false);
    });
  });
}

// Test webhook endpoint
function testWebhook() {
  return new Promise((resolve, reject) => {
    const client = baseUrl.startsWith('https') ? https : http;
    
    const postData = JSON.stringify({
      test: 'deployment test',
      remoteJid: '120363123456789012@g.us'
    });
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = client.request(`${baseUrl}/webhook/whatsapp`, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Webhook endpoint working');
          resolve(true);
        } else {
          console.log(`❌ Webhook endpoint failed - status: ${res.statusCode}`);
          resolve(false);
        }
      });
    });
    
    req.on('error', (err) => {
      console.log('❌ Webhook test failed - network error:', err.message);
      resolve(false);
    });
    
    req.write(postData);
    req.end();
  });
}

// Run tests
async function runTests() {
  console.log('\n🔍 Running deployment tests...\n');
  
  const healthOk = await testHealth();
  const webhookOk = await testWebhook();
  
  console.log('\n📊 Test Results:');
  console.log(`Health Check: ${healthOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Webhook Endpoint: ${webhookOk ? '✅ PASS' : '❌ FAIL'}`);
  
  if (healthOk && webhookOk) {
    console.log('\n🎉 Deployment is working correctly!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Check the deployment logs.');
    process.exit(1);
  }
}

runTests().catch(console.error);
