const fs = require('fs');

const files = [
  "src/components/AdminStatementReport.tsx",
  "src/components/BillPaymentReport.tsx",
  "src/components/BBPSHistory.tsx",
  "src/components/DistributorQRReport.tsx",
  "src/components/PayoutReport.tsx",
  "src/components/QRManagement.tsx",
  "src/components/QRHistoryTracking.tsx",
  "src/components/QRPaymentReport.tsx",
  "src/components/RechargeDashboard.tsx",
  "src/components/StatementReport.tsx",
  "src/components/user/UserViewReceipt.tsx",
  "src/components/user/UserReports.tsx",
  "src/components/user/UserCsplPayment.tsx",
  "src/components/user/UserAeps.tsx",
  "src/components/UsersList.tsx"
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace arrow functions lacking async, but containing 'await import('jspdf')' inside them.
    // Example: const funcName = (...) => {
    // We can just find all functions like `const downloadPDFReceipt = (receipt: any) => {`
    // and make them async.
    
    // Using a simpler approach, replace specifically known signatures that failed:
    content = content.replace(/const downloadReceiptPdf = \((.*?)\) => {/g, 'const downloadReceiptPdf = async ($1) => {');
    content = content.replace(/const exportPDF = \((.*?)\) => {/g, 'const exportPDF = async ($1) => {');
    content = content.replace(/const exportToPDF = \((.*?)\) => {/g, 'const exportToPDF = async ($1) => {');
    content = content.replace(/const downloadPDF = \((.*?)\) => {/g, 'const downloadPDF = async ($1) => {');
    content = content.replace(/const downloadPdf = \((.*?)\) => {/g, 'const downloadPdf = async ($1) => {');
    content = content.replace(/const downloadPDFReceipt = \((.*?)\) => {/g, 'const downloadPDFReceipt = async ($1) => {');
    content = content.replace(/const generatePDF = \((.*?)\) => {/g, 'const generatePDF = async ($1) => {');
    content = content.replace(/const handleDownloadPDF = \((.*?)\) => {/g, 'const handleDownloadPDF = async ($1) => {');

    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
}
