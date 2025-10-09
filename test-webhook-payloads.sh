#!/bin/bash

# WhatsApp Webhook Test Script
# This script contains real webhook payloads from EvolutionAPI for testing

echo "Testing WhatsApp Webhook Endpoints..."

# Test 1: Real WhatsApp message payload from EvolutionAPI
echo "1. Testing with real WhatsApp message payload..."
curl -X POST https://whatsapphook-production.up.railway.app/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -H "User-Agent: TestScript/1.0" \
  -d '{
    "data": {
      "key": {
        "id": "3B7EF1A9866D5255D724",
        "fromMe": false,
        "remoteJid": "120363418663151479@g.us",
        "participant": "23781250756724@lid"
      },
      "source": "unknown",
      "status": "DELIVERY_ACK",
      "message": {
        "conversation": "Source: Master Air Duct Cleaning NY\nID: #87EGX9L\nName: carin\nPhone: (866) 547-8711,2284\nAddress: 5 Queens St, Syosset, NY 11791-3005, United States\nJob: Dryer Vent\nAppt: 31 Aug 2025, 09:30-11:30 AM\ncx said she needs to know the pricing for drier vent cleaning said free estimate cx said she will cb for an appt after checking her schedule and hu cx asked how long it will take to clean the dryer vent wants tech to cb with more info\n\nTo Accept: https://dsp.cx/GSQZVcw\n\n\n\nClosing 150$\n cash \nclose to company:  138\ntax:  12\nDryer cleaning\n\nGuy 2  30\nYam   50",
        "messageContextInfo": {
          "messageSecret": "io3SNzf9+OMIYaIlR/4pvHMj9/RI3p9fTvsMAtqtClM="
        }
      },
      "pushName": "Oz Lavee",
      "instanceId": "97d240ed-9e1e-49e3-aad0-80fc74d18d33",
      "messageType": "conversation",
      "messageTimestamp": 1760043638
    },
    "event": "messages.upsert",
    "apikey": "58B5BE930282-49B3-947C-1C68049AFE5E",
    "sender": "972542233372@s.whatsapp.net",
    "instance": "My Phone",
    "date_time": "2025-10-09T18:00:38.981Z",
    "server_url": "https://evolution-api-production-0925.up.railway.app",
    "destination": "https://whatsapphook-production.up.railway.app/webhook/whatsapp"
  }'

echo -e "\n\n"

# Test 2: Simple test message
echo "2. Testing with simple test message..."
curl -X POST https://whatsapphook-production.up.railway.app/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -H "User-Agent: TestScript/1.0" \
  -d '{
    "data": {
      "key": {
        "id": "TEST_MESSAGE_123",
        "fromMe": false,
        "remoteJid": "120363418663151479@g.us",
        "participant": "23781250756724@lid"
      },
      "source": "unknown",
      "status": "DELIVERY_ACK",
      "message": {
        "conversation": "This is a test message for webhook testing",
        "messageContextInfo": {
          "messageSecret": "test_secret_123"
        }
      },
      "pushName": "Test User",
      "instanceId": "test-instance-123",
      "messageType": "conversation",
      "messageTimestamp": 1760044000
    },
    "event": "messages.upsert",
    "apikey": "TEST_API_KEY",
    "sender": "1234567890@s.whatsapp.net",
    "instance": "Test Instance",
    "date_time": "2025-10-09T21:00:00.000Z",
    "server_url": "https://test-evolution-api.up.railway.app",
    "destination": "https://whatsapphook-production.up.railway.app/webhook/whatsapp"
  }'

echo -e "\n\n"

# Test 3: Check logs
echo "3. Checking webhook logs..."
curl -s https://whatsapphook-production.up.railway.app/webhook/logs | jq '.data | length'

echo -e "\n\nDone! Check the logs endpoint for all webhook calls."
