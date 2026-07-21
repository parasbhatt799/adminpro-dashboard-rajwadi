const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./src');
let changedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  if (content.includes('import jsPDF from') || content.includes('import { jsPDF } from') || content.includes('jspdf-autotable')) {
    console.log('Fixing:', file);
    // Remove static imports
    content = content.replace(/import\s+jsPDF\s+from\s+['"]jspdf['"];?\r?\n?/g, '');
    content = content.replace(/import\s*\{\s*jsPDF\s*\}\s*from\s+['"]jspdf['"];?\r?\n?/g, '');
    content = content.replace(/import\s+autoTable\s+from\s+['"]jspdf-autotable['"];?\r?\n?/g, '');
    
    // Convert exportToPDF functions
    content = content.replace(/const exportToPDF = \(\) => \{/g, 'const exportToPDF = async () => {');
    
    // Replace new jsPDF(...) with dynamic import
    content = content.replace(/const doc = new jsPDF\(([^)]*)\);/g, `const module = await import('jspdf');
      const JsPDFClass = module.jsPDF || module.default;
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = autoTableModule.default || autoTableModule.autoTable || autoTableModule;
      const doc = new JsPDFClass($1);`);
      
    // Replace generic new jsPDF() without args
    content = content.replace(/const doc = new jsPDF\(\);/g, `const module = await import('jspdf');
      const JsPDFClass = module.jsPDF || module.default;
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = autoTableModule.default || autoTableModule.autoTable || autoTableModule;
      const doc = new JsPDFClass();`);
      
    if (content !== originalContent) {
      fs.writeFileSync(file, content);
      changedCount++;
    }
  }
});

console.log('Total files changed:', changedCount);
