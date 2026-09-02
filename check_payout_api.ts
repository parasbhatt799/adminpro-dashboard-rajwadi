import https from 'https';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = (process.env.CAMLENIO_PAYOUT_API_KEY || 'fjf0f2xy3W01NTtSDTUS62rdKyVqPSY7').replace(/['"]/g, '').trim();

function testPayoutApi() {
  const testAmount = process.argv[2] ? Number(process.argv[2]) : 1001;

  console.log('====================================================');
  console.log('  💸 CAMLENIO IMPS PAYOUT DIRECT API TESTER');
  console.log('====================================================\n');

  const payloadData = JSON.stringify({
    amount: testAmount,
    reference: 'REF' + Date.now(),
    bankAccount: '50100649427351',
    ifsc: 'HDFC0000588',
    name: 'TEST VANANI JIGNESH',
    bankName: 'HDFC BANK',
    phone: '9999999999',
    beneficiaryMobile: '9999999999',
    email: 'support@usepay.in'
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-TIMESTAMP': new Date().toISOString(),
    'X-REQUEST-ID': 'req-' + Date.now(),
    'X-API-KEY': API_KEY,
    'Content-Length': String(Buffer.byteLength(payloadData))
  };

  console.log('📤 OUTGOING REQUEST TO: https://cspl.camlenio.com/api/v1/np/payout/imps-payout');
  console.log('Headers:', JSON.stringify(headers, null, 2));
  console.log('Payload:', payloadData);
  console.log('\n----------------------------------------------------\n');

  const options: https.RequestOptions = {
    hostname: 'cspl.camlenio.com',
    port: 443,
    path: '/api/v1/np/payout/imps-payout',
    method: 'POST',
    headers: headers,
    family: 4 // Force IPv4 socket resolution
  };

  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => {
      console.log(`📥 HTTP STATUS CODE: ${res.statusCode}`);
      console.log('\n--- RAW API RESPONSE FROM CAMLENIO SERVER ---');
      try {
        const parsed = JSON.parse(body);
        console.log(JSON.stringify(parsed, null, 2));
      } catch (_) {
        console.log(body);
      }
      console.log('---------------------------------------------\n');
    });
  });

  req.on('error', (e) => {
    console.error('❌ Request Error:', e.message);
  });

  req.write(payloadData);
  req.end();
}

testPayoutApi();
