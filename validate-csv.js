#!/usr/bin/env node

/**
 * CSV Validation Script
 * Validates the structure and content of the CSV file
 */

const fs = require('fs');
const csv = require('csv-parser');

function validateCsv(csvFile) {
  console.log(`🔍 Validating CSV file: ${csvFile}\n`);
  
  let rowCount = 0;
  let validRows = 0;
  let invalidRows = 0;
  const errors = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvFile)
      .pipe(csv())
      .on('data', (row) => {
        rowCount++;
        
        // Check required fields
        const requiredFields = ['id', 'key', 'message', 'messageTimestamp'];
        const missingFields = requiredFields.filter(field => !row[field] || row[field].trim() === '');
        
        if (missingFields.length > 0) {
          invalidRows++;
          errors.push(`Row ${rowCount}: Missing fields: ${missingFields.join(', ')}`);
        } else {
          // Try to parse JSON fields
          try {
            const keyData = JSON.parse(row.key.replace(/""/g, '"'));
            const messageData = JSON.parse(row.message.replace(/""/g, '"'));
            
            if (!keyData.id || !keyData.remoteJid) {
              invalidRows++;
              errors.push(`Row ${rowCount}: Invalid key data structure`);
            } else if (!messageData.conversation && !messageData.editedMessage && !messageData.reactionMessage) {
              invalidRows++;
              errors.push(`Row ${rowCount}: No valid message content found`);
            } else {
              validRows++;
            }
          } catch (parseError) {
            invalidRows++;
            errors.push(`Row ${rowCount}: JSON parsing error - ${parseError.message}`);
          }
        }
        
        // Show progress every 10 rows
        if (rowCount % 10 === 0) {
          console.log(`   Processed ${rowCount} rows...`);
        }
      })
      .on('end', () => {
        console.log('\n📊 Validation Results:');
        console.log(`   📈 Total rows: ${rowCount}`);
        console.log(`   ✅ Valid rows: ${validRows}`);
        console.log(`   ❌ Invalid rows: ${invalidRows}`);
        console.log(`   📊 Success rate: ${((validRows / rowCount) * 100).toFixed(1)}%`);
        
        if (errors.length > 0) {
          console.log('\n❌ Errors found:');
          errors.slice(0, 10).forEach(error => console.log(`   ${error}`));
          if (errors.length > 10) {
            console.log(`   ... and ${errors.length - 10} more errors`);
          }
        }
        
        resolve({ rowCount, validRows, invalidRows, errors });
      })
      .on('error', (error) => {
        console.error(`❌ Error reading CSV file: ${error.message}`);
        reject(error);
      });
  });
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: node validate-csv.js <csv_file>');
    console.log('Example: node validate-csv.js "zehava 3.csv"');
    process.exit(1);
  }
  
  const csvFile = args[0];
  
  if (!fs.existsSync(csvFile)) {
    console.error(`❌ Error: CSV file '${csvFile}' not found`);
    process.exit(1);
  }
  
  try {
    await validateCsv(csvFile);
  } catch (error) {
    console.error(`❌ Validation failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { validateCsv };
