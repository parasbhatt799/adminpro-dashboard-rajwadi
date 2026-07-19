import { callBillAvenueApi } from './services/billavenue.js';

async function test(url) {
  try {
    console.log("Testing:", url);
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<depositDetailsRequest>
    <fromDate>2024-04-01</fromDate>
    <toDate>2024-04-01</toDate>
    <transType></transType>
</depositDetailsRequest>`;
    const res = await callBillAvenueApi(url, xml);
    console.log("Result:", JSON.stringify(res, null, 2));
  } catch (e) {
    console.error("Error:", e.message);
  }
}

async function main() {
    await test('https://api.billavenue.com/billpay/enquireDeposit/fetchDetails/xml');
}

main();
