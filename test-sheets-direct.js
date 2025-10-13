#!/usr/bin/env node

/**
 * Direct test of Google Sheets operations
 */

const testOrderData = {
  work_id: "#87EGX9L",
  customer_name: "carin",
  address: "5 Queens St, Syosset, NY 11791-3005, United States",
  phone: "(866) 547-8711,2284",
  job_description: "Dryer Vent",
  total_price: 150,
  deposit: 0,
  job_status: "new",
  start_date_time: "2025-08-31T09:30:00.000Z",
  end_date_time: "2025-08-31T11:30:00.000Z",
  sort_of_payment: "cash",
  notes: "cx said she needs to know the pricing for drier vent cleaning said free estimate cx said she will cb for an appt after checking her schedule and hu cx asked how long it will take to clean the dryer vent wants tech to cb with more info",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: "Oz Lavee",
  updated_by: "Oz Lavee"
};

const testMessage = "Source: Master4 Air Duct Cleaning NY\nID: #87EGX9L\nName: carin\nPhone: (866) 547-8711,2284\nAddress: 5 Queens St, Syosset, NY 11791-3005, United States\nJob: Dryer Vent\nAppt: 31 Aug 2025, 09:30-11:30 AM\ncx said she needs to know the pricing for drier vent cleaning said free estimate cx said she will cb for an appt after checking her schedule and hu cx asked how long it will take to clean the dryer vent wants tech to cb with more info\n\nTo Accept: https://dsp.cx/GSQZVcw\n\n\n\nClosing 150$\n cash \nclose to company:  138\ntax:  12\nDryer cleaning\n\nGuy 2  30\nYam   50";

console.log('Testing direct Google Sheets operation...');
console.log('Order Data:', JSON.stringify(testOrderData, null, 2));

const http = require('http');

const postData = JSON.stringify({ 
  orderData: testOrderData,
  fullMessage: testMessage
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/webhook/test-create-order',
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
