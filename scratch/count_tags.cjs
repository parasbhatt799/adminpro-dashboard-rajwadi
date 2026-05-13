const fs = require('fs');
const content = fs.readFileSync('src/components/QRManagement.tsx', 'utf8');
const openBraces = (content.match(/{/g) || []).length;
const closeBraces = (content.match(/}/g) || []).length;
const openDiv = (content.match(/<div/g) || []).length;
const closeDiv = (content.match(/<\/div>/g) || []).length;
const openMotion = (content.match(/<motion.div/g) || []).length;
const closeMotion = (content.match(/<\/motion.div>/g) || []).length;
const openAnimate = (content.match(/<AnimatePresence/g) || []).length;
const closeAnimate = (content.match(/<\/AnimatePresence>/g) || []).length;
const openFragment = (content.match(/<>/g) || []).length;
const closeFragment = (content.match(/<\/>/g) || []).length;

console.log(`Braces: { ${openBraces}, } ${closeBraces}`);
console.log(`Divs: <div ${openDiv}, </div> ${closeDiv}`);
console.log(`Motion: <motion ${openMotion}, </motion ${closeMotion}`);
console.log(`Animate: <Animate ${openAnimate}, </Animate ${closeAnimate}`);
console.log(`Fragment: <> ${openFragment}, </> ${closeFragment}`);
