import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';

const WORKING_KEY = process.env.BILLAVENUE_WORKING_KEY || "";
const IV = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

function decryptResponse(encText) {
  const key = crypto.createHash('md5').update(WORKING_KEY).digest();
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, IV);
  let decrypted = decipher.update(encText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

const hex = "55f04ac985a33bc9d01586563cede79ad096002471dbd57fa10dcca450aacaccbb8731b8e03554c3ebd9159f95e581a829d5646854c181e0828a825570a9d38bacd64f58b2ae945f0f4f10895620f4981c04be97bf8506d65d167da42dc9b613d2d261d8ff3bf29c8e145888075b8f3b5f94e576107d775137f3eb95873abf74";

try {
  console.log("Decrypting Email Hex...");
  console.log("WORKING_KEY used:", WORKING_KEY);
  const decrypted = decryptResponse(hex);
  console.log("Decrypted XML from email:");
  console.log(decrypted);
} catch (e: any) {
  console.error("Decryption failed:", e.message);
}
