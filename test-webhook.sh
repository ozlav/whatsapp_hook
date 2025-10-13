#!/bin/bash

# Test script to call the messages-upsert endpoint with a specific payload
# Usage: ./test-webhook.sh [port]

PORT=${1:-3000}
HOST="localhost"
URL="http://${HOST}:${PORT}/webhook/whatsapp/messages-upsert"

echo "🚀 Testing webhook endpoint: ${URL}"
echo ""

# Test payload
PAYLOAD='{
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
}'

echo "📦 Sending payload..."
echo "👤 Sender: Oz Lavee"
echo "🏠 Group: 120363418663151479@g.us"
echo "📋 Message: Source: Master4 Air Duct Cleaning NY..."
echo ""

# Make the curl request
curl -X POST "${URL}" \
  -H "Content-Type: application/json" \
  -H "x-request-id: test-$(date +%s)" \
  -H "User-Agent: Test-Script/1.0" \
  -d "${PAYLOAD}" \
  -w "\n\n📊 Response Info:\nHTTP Code: %{http_code}\nTime: %{time_total}s\nSize: %{size_download} bytes\n" \
  -s

echo ""
echo "✅ Test completed!"
