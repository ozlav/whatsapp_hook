#!/bin/bash

# Production test script for WhatsApp webhook
# Usage: ./test-production.sh [test_type]
# Test types: health, new-message, reply-message, all (default: all)

TEST_TYPE=${1:-all}
HOST="whatsapphook-production.up.railway.app"

echo "🚀 Testing WhatsApp webhook production deployment"
echo "🌍 Host: ${HOST}"
echo "🧪 Test Type: ${TEST_TYPE}"
echo ""

# Health check function
test_health() {
  echo "🏥 Testing health endpoint..."
  URL="https://${HOST}/webhook/test"
  
  curl -X GET "${URL}" \
    -H "x-request-id: health-test-$(date +%s)" \
    -H "User-Agent: Test-Script/1.0" \
    -w "\n\n📊 Response Info:\nHTTP Code: %{http_code}\nTime: %{time_total}s\nSize: %{size_download} bytes\n" \
    -s
  
  echo ""
  echo "✅ Health check completed!"
  echo ""
}

# New message test function
test_new_message() {
  echo "📝 Testing new message webhook..."
  ./test-webhook.sh production
  echo ""
}

# Reply message test function
test_reply_message() {
  echo "💬 Testing reply message webhook..."
  ./test-reply-message.sh production
  echo ""
}

# Run tests based on type
case $TEST_TYPE in
  "health")
    test_health
    ;;
  "new-message")
    test_new_message
    ;;
  "reply-message")
    test_reply_message
    ;;
  "all")
    test_health
    test_new_message
    test_reply_message
    ;;
  *)
    echo "❌ Invalid test type: $TEST_TYPE"
    echo "Valid options: health, new-message, reply-message, all"
    exit 1
    ;;
esac

echo "🎉 All tests completed!"
