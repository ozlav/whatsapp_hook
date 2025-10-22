#!/usr/bin/env node

/**
 * Debug script to test message analysis
 */

const testPayload = {
  "event": "messages.upsert",
  "instance": "My Phone",
  "data": {
    "key": {
      "remoteJid": "120363418663151479@g.us",
      "fromMe": false,
      "id": "3BE214A91FDE9677D58F",
      "participant": "23781250756724@lid"
    },
    "pushName": "Oz Lavee",
    "status": "DELIVERY_ACK",
    "message": {
      "conversation": "Source: Master4 Air Duct Cleaning NY\nID: #87EGX9L\nName: carin\nPhone: (866) 547-8711,2284\nAddress: 5 Queens St, Syosset, NY 11791-3005, United States\nJob: Dryer Vent\nAppt: 31 Aug 2025, 09:30-11:30 AM\ncx said she needs to know the pricing for drier vent cleaning said free estimate cx said she will cb for an appt after checking her schedule and hu cx asked how long it will take to clean the dryer vent wants tech to cb with more info\n\nTo Accept: https://dsp.cx/GSQZVcw\n\n\n\nClosing 150$\n cash \nclose to company:  138\ntax:  12\nDryer cleaning\n\nGuy 2  30\nYam   50",
      "messageContextInfo": {
        "messageSecret": "zK6q6ehfHxS4D0WwiMdLo99rII8Ltw5/8vpQuRQ8l+k="
      }
    },
    "messageType": "conversation",
    "messageTimestamp": 1760338484,
    "instanceId": "97d240ed-9e1e-49e3-aad0-80fc74d18d33",
    "source": "unknown"
  },
  "destination": "https://whatsapphook-production.up.railway.app/webhook/whatsapp",
  "date_time": "2025-10-13T03:54:44.672Z",
  "sender": "972542233372@s.whatsapp.net",
  "server_url": "https://evolution-api-production-0925.up.railway.app",
  "apikey": "58B5BE930282-49B3-947C-1C68049AFE5E"
};

console.log('Testing message analysis...');
console.log('Message text:', testPayload.data.message.conversation.substring(0, 100) + '...');
console.log('Sender:', testPayload.data.pushName);
console.log('Group:', testPayload.data.key.remoteJid);

// Test the analysis endpoint
const http = require('http');

const postData = JSON.stringify({ message: testPayload });

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/graph/process',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  console.log(`\nResponse Status: ${res.statusCode}`);
  
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', responseData);
  });
});

req.on('error', (error) => {
  console.error('Request failed:', error.message);
});

req.write(postData);
req.end();
