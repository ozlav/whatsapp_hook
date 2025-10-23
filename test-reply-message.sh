#!/bin/bash

# Test script for REPLY message (with contextInfo.stanzaId)
# Usage: ./test-reply-message.sh [environment]
# Environment options: local, production (default: production)

ENVIRONMENT=${1:-production}

if [ "$ENVIRONMENT" = "local" ]; then
  HOST="localhost"
  PORT="3000"
  URL="http://${HOST}:${PORT}/webhook/whatsapp/messages-upsert"
else
  HOST="whatsapphook-production.up.railway.app"
  URL="https://${HOST}/webhook/whatsapp/messages-upsert"
fi

echo "🚀 Testing REPLY message webhook endpoint: ${URL}"
echo "🌍 Environment: ${ENVIRONMENT}"
echo ""

# Test payload for REPLY message (has contextInfo.stanzaId)
PAYLOAD='{
  "event": "messages.upsert",
  "instance": "My Phone",
  "data": {
    "key": {
      "remoteJid": "120363420497664775@g.us",
      "fromMe": false,
      "id": "3BD21D0797E019EC195B",
      "participant": "23781250756724@lid"
    },
    "pushName": "Oz Lavee",
    "status": "DELIVERY_ACK",
    "message": {
      "messageContextInfo": {
        "messageSecret": "fObT1eRfFz5O595rk244mn31iKe5WkwG9tzHNO1rHnU="
      },
      "conversation": "Done"
    },
    "contextInfo": {
      "stanzaId": "3BE214A91FDE9677D58F",
      "participant": "23781250756724@lid",
      "quotedMessage": {
        "conversation": "Source: Master4 Air Duct Cleaning NY\nID: #87EGX9L\nName: carin\nPhone: (866) 547-8711,2284\nAddress: 5 Queens St, Syosset, NY 11791-3005, United States\nJob: Dryer Vent\nAppt: 31 Aug 2025, 09:30-11:30 AM\ncx said she needs to know the pricing for drier vent cleaning said free estimate cx said she will cb for an appt after checking her schedule and hu cx asked how long it will take to clean the dryer vent wants tech to cb with more info\n\nTo Accept: https://dsp.cx/GSQZVcw\n\n\n\nClosing 150$\n cash \nclose to company:  138\ntax:  12\nDryer cleaning\n\nGuy 2  30\nYam   50"
      }
    },
    "messageType": "conversation",
    "messageTimestamp": 1760338510,
    "instanceId": "97d240ed-9e1e-49e3-aad0-80fc74d18d33",
    "source": "unknown"
  },
  "destination": "https://whatsapphook-production.up.railway.app/webhook/whatsapp",
  "date_time": "2025-10-13T03:55:10.733Z",
  "sender": "972542233372@s.whatsapp.net",
  "server_url": "https://evolution-api-production-0925.up.railway.app",
  "apikey": "58B5BE930282-49B3-947C-1C68049AFE5E"
}'

echo "📦 Sending REPLY payload..."
echo "👤 Sender: Oz Lavee"
echo "🏠 Group: 120363420497664775@g.us"
echo "📋 Message: Done"
echo "🔗 Replying to: 3BE214A91FDE9677D58F"
echo ""

# Make the curl request
curl -X POST "${URL}" \
  -H "Content-Type: application/json" \
  -H "x-request-id: test-reply-$(date +%s)" \
  -H "User-Agent: Test-Script/1.0" \
  -d "${PAYLOAD}" \
  -w "\n\n📊 Response Info:\nHTTP Code: %{http_code}\nTime: %{time_total}s\nSize: %{size_download} bytes\n" \
  -s

echo ""
echo "✅ Reply test completed!"
