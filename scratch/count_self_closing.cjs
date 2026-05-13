const fs = require('fs');
const content = fs.readFileSync('src/components/QRManagement.tsx', 'utf8');
const selfClosing = (content.match(/<div[^>]*\/>/g) || []).length;
console.log(`Self-closing Divs: ${selfClosing}`);
