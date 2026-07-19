import { callBillAvenueApi } from './services/billavenue.js';

const INSTITUTE_ID = 'CC01'; // Let's try institute id or agent id

async function test(url, idNode) {
  try {
    console.log("Testing:", url, "with", idNode);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<depositEnquiryRequest>
    ${idNode}
</depositEnquiryRequest>`;
    const res = await callBillAvenueApi(url, xml);
    console.log("Result:", JSON.stringify(res, null, 2));
  } catch (e) {
    console.error("Error:", e.message);
  }
}

async function main() {
    await test('https://api.billavenue.com/billpay/extDeposit/enquiry/xml', '<agentId>CC01RS13AGTBBG162607</agentId>');
    await test('https://api.billavenue.com/billpay/enquireDeposit/fetchDetails/xml', '<instituteId>CC01</instituteId>');
    await test('https://api.billavenue.com/billpay/extDeposit/enquiry/xml', '<billerId>CC01</billerId>');
}

main();
