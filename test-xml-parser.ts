import { xmlToJson } from './services/billavenue.js';

const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<DepositEnquiryResponse>
  <responseCode>000</responseCode>
  <instituteId>OU21</instituteId>
  <currentBalance>252000.00</currentBalance>
  <currency>INR</currency>
  <transaction>
     <entry>
       <agentId>OU21AB11AGT000008032</agentId>
     </entry>
  </transaction>
</DepositEnquiryResponse>`;

console.log(JSON.stringify(xmlToJson(xml), null, 2));
