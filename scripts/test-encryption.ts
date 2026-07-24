import crypto from 'crypto';

const WORKING_KEY = '57259B1F76AEAB4E809A959D5E69322A'; // Try default, or I need to read from env if it's different. Wait, user's email mentions RS13, so their working key might be different. Let's load from .env!
import dotenv from 'dotenv';
dotenv.config();

const key = process.env.BILLAVENUE_WORKING_KEY || '57259B1F76AEAB4E809A959D5E69322A';
const IV = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

function encryptRequest(plainText: string): string {
  const md5Key = crypto.createHash('md5').update(key).digest();
  const cipher = crypto.createCipheriv('aes-128-cbc', md5Key, IV);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

// Exactly as in email
const xml1 = `<?xml version="1.0" encoding="UTF-8"?>
<billerInfoRequest>
<billerId>BKESL0000RAJ02</billerId>
</billerInfoRequest>`;

// Without newlines
const xml2 = `<?xml version="1.0" encoding="UTF-8"?><billerInfoRequest><billerId>BKESL0000RAJ02</billerId></billerInfoRequest>`;

// Exact match up to 48 bytes:
const xml3 = `<?xml version="1.0" encoding="UTF-8"?>\r\n<billerInfoRequest>\r\n<billerId>BKESL0000RAJ02</billerId>\r\n</billerInfoRequest>`;

const expected = '55f04ac985a33bc9d01586563cede79ad096002471dbd57fa10dcca450aacaccbb8731b8e03554c3ebd9159f95e581a829d5646854c181e0828a825570a9d38bacd64f58b2ae945f0f4f10895620f4981c04be97bf8506d65d167da42dc9b613d2d261d8ff3bf29c8e145888075b8f3b5f94e576107d775137f3eb95873abf74';
const xml4 = `<?xml version="1.0" encoding="UTF-8"?>\r\n<billerInfoRequest>\n<billerId>BKESL0000RAJ02</billerId>\n</billerInfoRequest>`;

const xml5 = `<?xml version="1.0" encoding="UTF-8"?>\n<billerInfoRequest>\r\n<billerId>BKESL0000RAJ02</billerId>\r\n</billerInfoRequest>`;

console.log('XML4 Enc: ', encryptRequest(xml4).toLowerCase());
console.log('XML5 Enc: ', encryptRequest(xml5).toLowerCase());
console.log('Matches 4?', encryptRequest(xml4).toLowerCase() === expected);
console.log('Matches 5?', encryptRequest(xml5).toLowerCase() === expected);
