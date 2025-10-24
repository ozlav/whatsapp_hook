#!/usr/bin/env python3
"""
CSV Message Processor for WhatsApp Webhook
Processes messages from zehava 3.csv and sends them to the webhook endpoint
"""

import csv
import json
import requests
import time
import sys
from datetime import datetime
from typing import Dict, Any, Optional

class MessageProcessor:
    def __init__(self, environment: str = "production", delay: float = 1.0):
        self.environment = environment
        self.delay = delay
        
        if environment == "local":
            self.host = "localhost"
            self.port = "3000"
            self.url = f"http://{self.host}:{self.port}/webhook/whatsapp/messages-upsert"
        else:
            self.host = "whatsapphook-production.up.railway.app"
            self.url = f"https://{self.host}/webhook/whatsapp/messages-upsert"
        
        # Common webhook metadata
        self.webhook_metadata = {
            "destination": "https://whatsapphook-production.up.railway.app/webhook/whatsapp",
            "sender": "972542233372@s.whatsapp.net",
            "server_url": "https://evolution-api-production-0925.up.railway.app",
            "apikey": "58B5BE930282-49B3-947C-1C68049AFE5E"
        }
    
    def parse_json_field(self, json_str: str) -> Dict[str, Any]:
        """Parse JSON string field from CSV, handling escaped quotes"""
        if not json_str or json_str.strip() == "":
            return {}
        
        try:
            # Replace escaped quotes with regular quotes for proper JSON parsing
            cleaned_json = json_str.replace('""', '"')
            return json.loads(cleaned_json)
        except json.JSONDecodeError as e:
            print(f"⚠️  JSON parsing error: {e}")
            print(f"   Raw string: {json_str[:100]}...")
            return {}
    
    def build_payload(self, row: Dict[str, str]) -> Optional[Dict[str, Any]]:
        """Build webhook payload from CSV row"""
        try:
            # Parse JSON fields
            key_data = self.parse_json_field(row.get('key', '{}'))
            message_data = self.parse_json_field(row.get('message', '{}'))
            context_info = self.parse_json_field(row.get('contextInfo', ''))
            
            # Skip empty rows
            if not key_data or not message_data:
                return None
            
            # Extract basic fields
            message_timestamp = int(row.get('messageTimestamp', 0))
            if message_timestamp == 0:
                message_timestamp = int(time.time())
            
            # Build the payload structure
            payload = {
                "event": "messages.upsert",
                "instance": "My Phone",
                "data": {
                    "key": key_data,
                    "pushName": row.get('pushName', 'Unknown'),
                    "status": row.get('status', 'READ'),
                    "message": message_data,
                    "messageType": row.get('messageType', 'conversation'),
                    "messageTimestamp": message_timestamp,
                    "instanceId": row.get('instanceId', '97d240ed-9e1e-49e3-aad0-80fc74d18d33'),
                    "source": row.get('source', 'unknown')
                },
                **self.webhook_metadata
            }
            
            # Add contextInfo if present (for reply messages)
            if context_info:
                payload["data"]["contextInfo"] = context_info
            
            # Add date_time
            dt = datetime.fromtimestamp(message_timestamp)
            payload["date_time"] = dt.strftime("%Y-%m-%dT%H:%M:%S.%fZ")
            
            return payload
            
        except Exception as e:
            print(f"❌ Error building payload for row {row.get('id', 'unknown')}: {e}")
            return None
    
    def send_message(self, payload: Dict[str, Any], row_id: str) -> bool:
        """Send message to webhook endpoint"""
        try:
            headers = {
                "Content-Type": "application/json",
                "x-request-id": f"csv-{row_id}-{int(time.time())}",
                "User-Agent": "CSV-Processor/1.0"
            }
            
            response = requests.post(
                self.url,
                json=payload,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                print(f"✅ Row {row_id}: Success (HTTP {response.status_code})")
                return True
            else:
                print(f"❌ Row {row_id}: Failed (HTTP {response.status_code})")
                print(f"   Response: {response.text[:200]}...")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Row {row_id}: Network error - {e}")
            return False
    
    def process_csv(self, csv_file: str, start_row: int = 1, max_rows: Optional[int] = None):
        """Process CSV file and send messages"""
        print(f"🚀 Processing CSV: {csv_file}")
        print(f"🌍 Environment: {self.environment}")
        print(f"🔗 Endpoint: {self.url}")
        print(f"⏱️  Delay between requests: {self.delay}s")
        print(f"📊 Starting from row: {start_row}")
        if max_rows:
            print(f"📊 Max rows to process: {max_rows}")
        print()
        
        success_count = 0
        error_count = 0
        skipped_count = 0
        
        try:
            with open(csv_file, 'r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                
                for i, row in enumerate(reader, 1):
                    # Skip rows before start_row
                    if i < start_row:
                        continue
                    
                    # Check max_rows limit
                    if max_rows and (i - start_row + 1) > max_rows:
                        break
                    
                    row_id = row.get('id', f'row_{i}')
                    print(f"📤 Processing row {i} (ID: {row_id})...")
                    
                    # Build payload
                    payload = self.build_payload(row)
                    if not payload:
                        print(f"⏭️  Skipping row {i} - empty or invalid data")
                        skipped_count += 1
                        continue
                    
                    # Send message
                    if self.send_message(payload, row_id):
                        success_count += 1
                    else:
                        error_count += 1
                    
                    # Delay between requests
                    if i < len(list(reader)) + start_row - 1:  # Don't delay after last request
                        time.sleep(self.delay)
                
        except FileNotFoundError:
            print(f"❌ Error: CSV file '{csv_file}' not found")
            return
        except Exception as e:
            print(f"❌ Error processing CSV: {e}")
            return
        
        print()
        print("📊 Processing Summary:")
        print(f"   ✅ Successful: {success_count}")
        print(f"   ❌ Failed: {error_count}")
        print(f"   ⏭️  Skipped: {skipped_count}")
        print(f"   📈 Total processed: {success_count + error_count + skipped_count}")

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 process-csv-messages.py <csv_file> [environment] [start_row] [max_rows] [delay]")
        print("  csv_file: Path to CSV file (e.g., 'zehava 3.csv')")
        print("  environment: local or production (default: production)")
        print("  start_row: Row number to start from (default: 1)")
        print("  max_rows: Maximum number of rows to process (default: all)")
        print("  delay: Delay between requests in seconds (default: 1.0)")
        print()
        print("Examples:")
        print("  python3 process-csv-messages.py 'zehava 3.csv'")
        print("  python3 process-csv-messages.py 'zehava 3.csv' local")
        print("  python3 process-csv-messages.py 'zehava 3.csv' production 5 10")
        print("  python3 process-csv-messages.py 'zehava 3.csv' production 1 5 0.5")
        sys.exit(1)
    
    csv_file = sys.argv[1]
    environment = sys.argv[2] if len(sys.argv) > 2 else "production"
    start_row = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    max_rows = int(sys.argv[4]) if len(sys.argv) > 4 else None
    delay = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0
    
    processor = MessageProcessor(environment, delay)
    processor.process_csv(csv_file, start_row, max_rows)

if __name__ == "__main__":
    main()
