const fs = require('fs');

const files = [
  'src/components/user/UserBillAvenuePayment.tsx',
  'src/components/user/UserCsplPayment.tsx'
];

files.forEach(file => {
  let code = fs.readFileSync(file, 'utf8');

  // Remove from receipt generation
  code = code.replace(/        \['Customer Convenience Fees', `INR \$\{Number\(receipt\.ccf1Fee\)\.toFixed\(2\)\}`\],\n/g, '');
  code = code.replace(/        \['Payment Mode', receipt\.paymentMode \|\| 'N\/A'\],\n/g, '');

  // Remove from BILL SUMMARY breakdown
  code = code.replace(/                                        <div className="flex justify-between items-center text-xs text-slate-500 font-medium">\n                                          <span>Customer Convenience Fees<\/span>\n                                          <span className="font-semibold text-indigo-500">\+ ₹\{ccf1Fee\.toLocaleString\('en-IN', \{ minimumFractionDigits: 2 \}\)\}<\/span>\n                                        <\/div>\n/g, '');
  
  // Remove from QUICK PAY / RECHARGE breakdown
  code = code.replace(/                                      \{ccf1Fee > 0 && \(\n                                        <div className="flex justify-between items-center text-xs text-slate-500 font-medium">\n                                          <span>Convenience Fee \(CCF1 \+ GST\)<\/span>\n                                          <span className="font-bold text-indigo-600">\+ ₹\{ccf1Fee\.toLocaleString\('en-IN', \{ minimumFractionDigits: 2 \}\)\}<\/span>\n                                        <\/div>\n                                      \)\}\n/g, '');
  code = code.replace(/                                    \{ccf1Fee > 0 && \(\n                                      <div className="flex justify-between items-center text-xs text-slate-500 font-medium">\n                                        <span>Convenience Fee \(CCF1 \+ GST\)<\/span>\n                                        <span className="font-bold text-indigo-600">\+ ₹\{ccf1Fee\.toLocaleString\('en-IN', \{ minimumFractionDigits: 2 \}\)\}<\/span>\n                                      <\/div>\n                                    \)\}\n/g, '');

  // Update total debited formulas
  code = code.replace(/\(Number\(manualAmount\) \+ ccf1Fee \+ calculateServiceCharge\(Number\(manualAmount\)\)\)/g, '(Number(manualAmount) + calculateServiceCharge(Number(manualAmount)))');
  code = code.replace(/\(Number\(manualAmount\) \+ calculateServiceCharge\(Number\(manualAmount\)\) \+ ccf1Fee\)/g, '(Number(manualAmount) + calculateServiceCharge(Number(manualAmount)))');

  // Remove payment mode selector
  code = code.replace(/                                  \{\/\* Payment Mode Selector \*\/\}\n                                  <div className="space-y-1\.5 border-t border-slate-100 pt-3">\n                                    <label className="text-\[10px\] font-black text-slate-400 uppercase tracking-wider block">Payment Mode<\/label>\n                                    <select\n                                      value=\{selectedPaymentMode\}\n                                      onChange=\{\(e\) => setSelectedPaymentMode\(e\.target\.value\)\}\n                                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-xs font-semibold text-slate-700 focus:border-indigo-500 cursor-pointer"\n                                    >\n                                      <option value="UPI">UPI<\/option>\n                                      <option value="Wallet">Wallet Balance<\/option>\n                                      <option value="Net Banking">Net Banking<\/option>\n                                      <option value="Debit Card">Debit Card<\/option>\n                                      <option value="Credit Card">Credit Card<\/option>\n                                    <\/select>\n                                  <\/div>\n/g, '');

  // Remove from UI Receipt View
  code = code.replace(/                        <div className="flex justify-between border-b border-slate-100 pb-2">\n                          <span className="text-slate-400 uppercase tracking-wider text-\[9px\]">Customer Convenience Fees<\/span>\n                          <span className="font-black text-slate-800 text-right">₹\{receipt\.ccf1Fee\.toFixed\(2\)\}<\/span>\n                        <\/div>\n/g, '');
  code = code.replace(/                        <div className="flex justify-between border-b border-slate-100 pb-2">\n                          <span className="text-slate-400 uppercase tracking-wider text-\[9px\]">Payment Mode<\/span>\n                          <span className="font-black text-slate-800 text-right">\{receipt\.paymentMode\}<\/span>\n                        <\/div>\n/g, '');
  
  fs.writeFileSync(file, code);
  console.log('Processed', file);
});
