import { callBillAvenueApi } from './services/billavenue.js';

const AGENT_ID = 'CC01RS13AGTBBG162607';

async function test(url) {
  try {
    console.log("Testing:", url);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<depositEnquiryRequest>
    <agentId>${AGENT_ID}</agentId>
</depositEnquiryRequest>`;
    const res = await callBillAvenueApi(url, xml);
    console.log("Result:", JSON.stringify(res, null, 2));
  } catch (e) {
    console.error("Error:", e.message);
  }
}

async function main() {
    await test('https://stgapi.billavenue.com/billpay/extDeposit/enquiry/xml');
}

main();
