import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.CAMLENIO_AEPS_BASE_URL || 'https://cspl.camlenio.com';
const API_KEY = process.env.CAMLENIO_AEPS_API_KEY || '';

async function test() {
  const endpoint = `${BASE_URL}/api/v1/payout/pennydrop`; // guessed endpoint
  console.log('Hitting:', endpoint);
  
  const timestamp = new Date().toISOString();
  const requestId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TIMESTAMP': timestamp,
        'X-REQUEST-ID': requestId,
        'X-API-KEY': API_KEY,
      },
      body: JSON.stringify({
        accountNumber: "100058851466",
        ifsc: "INDB0000285",
        transactionId: "T" + Date.now()
      })
    });
    
    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Response:', text);
  } catch (e) {
    console.error(e);
  }
}

test();
