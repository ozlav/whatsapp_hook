#!/usr/bin/env node

/**
 * Test script for CSV Message Processor
 * Tests the processor with a small subset of messages
 */

const { MessageProcessor } = require('./process-csv-messages.js');

async function testProcessor() {
  console.log('🧪 Testing CSV Message Processor...\n');
  
  // Test with local environment and small delay
  const processor = new MessageProcessor('local', 500);
  
  try {
    // Test processing first 3 rows
    await processor.processCsv('zehava 3.csv', 1, 3);
    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run test
testProcessor().catch(console.error);
