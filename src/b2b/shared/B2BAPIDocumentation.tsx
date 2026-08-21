import React, { useState } from 'react';
import { Book, Code, Key, Server, AlertCircle, Copy, CheckCircle2, Activity, Terminal, ShieldAlert, DollarSign, Layers, Globe, RefreshCw, FileText, ChevronRight, Check, Download } from 'lucide-react';
import { format } from 'date-fns';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

export default function B2BAPIDocumentation() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState<'curl' | 'nodejs' | 'python' | 'php'>('curl');
  const [exportingPdf, setExportingPdf] = useState(false);

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://api.usepay.in';

  const handleExportPDF = async () => {
    setExportingPdf(true);
    try {
      const module = await import('jspdf');
      const JsPDFClass = module.jsPDF || module.default;
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = (autoTableModule.default || (autoTableModule as any).autoTable || autoTableModule) as any;

      const doc = new JsPDFClass({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      const drawHeader = (titleText: string) => {
        doc.setFillColor(15, 23, 42); // slate-900
        doc.rect(0, 0, 210, 25, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(titleText, 14, 12);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(`Base Endpoint: ${baseUrl}/api/v1/b2b  |  Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, 14, 19);
      };

      const checkPageBreak = (currentY: number, neededSpace: number) => {
        if (currentY + neededSpace > 272) {
          doc.addPage();
          drawHeader('B2B Bill Payment API Reference (Contd.)');
          return 32;
        }
        return currentY;
      };

      const drawCodeBlock = (title: string, codeStr: string, startY: number) => {
        const lines = codeStr.split('\n');
        const blockHeight = 8 + (lines.length * 3.8);
        let y = checkPageBreak(startY, blockHeight);

        // Code Header Bar
        doc.setFillColor(30, 41, 59);
        doc.rect(14, y, 182, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(165, 180, 252);
        doc.text(title, 18, y + 4.2);

        // Code Content Box
        doc.setFillColor(15, 23, 42);
        doc.rect(14, y + 6, 182, blockHeight - 6, 'F');

        doc.setFont('courier', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(52, 211, 153);

        let lineY = y + 10.5;
        lines.forEach(line => {
          doc.text(line.length > 95 ? line.substring(0, 95) + '...' : line, 18, lineY);
          lineY += 3.8;
        });

        return y + blockHeight + 6;
      };

      // Page 1 Header
      drawHeader('B2B Bill Payment API Reference');
      let y = 32;

      // Section 1: Authentication & Headers
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text('1. Authentication & Mandatory HTTP Headers', 14, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        head: [['Header Name', 'Value Format', 'Description']],
        body: [
          ['x-api-key', 'String (pub_live_...)', 'Public API key issued from Agent Credentials portal'],
          ['x-secret-key', 'String (sec_live_...)', 'Secret API key used to authenticate your system'],
          ['Content-Type', 'application/json', 'Required payload content type for POST requests']
        ],
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 }
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // Section 2: API Endpoints Overview
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text('2. API Endpoints Overview', 14, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        head: [['Method', 'Endpoint Path', 'Description']],
        body: [
          ['GET', '/balance', 'Fetch current available agent wallet balance in Rupees'],
          ['GET', '/categories', 'Fetch supported biller categories (Electricity, Fastag, Water, etc.)'],
          ['GET', '/billers', 'Fetch billers list and required customer input parameters'],
          ['POST', '/fetch-bill', 'Fetch customer bill amount, due date, and biller details'],
          ['POST', '/pay-bill', 'Process bill payment and deduct funds from agent wallet'],
          ['GET', '/status/:transaction_id', 'Check real-time live status of a transaction']
        ],
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 }
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      // Section 2.1 GET /balance
      y = checkPageBreak(y, 45);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(79, 70, 229);
      doc.text('2.1 GET /balance - Check Agent Wallet Balance', 14, y);
      y += 4;
      y = drawCodeBlock('Sample Response (200 OK)', `{\n  "status": "success",\n  "data": {\n    "balance": 15450.75,\n    "currency": "INR"\n  }\n}`, y);

      // Section 2.2 GET /categories
      y = checkPageBreak(y, 65);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(79, 70, 229);
      doc.text('2.2 GET /categories - Fetch Biller Categories', 14, y);
      y += 4;
      y = drawCodeBlock('Sample Response (200 OK)', `{\n  "status": "success",\n  "data": [\n    { "category_name": "Electricity", "code": "ELECTRICITY" },\n    { "category_name": "Credit Card", "code": "CREDIT_CARD" },\n    { "category_name": "Fastag", "code": "FASTAG" },\n    { "category_name": "Water", "code": "WATER" }\n  ]\n}`, y);

      // Section 2.3 GET /billers
      y = checkPageBreak(y, 75);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(79, 70, 229);
      doc.text('2.3 GET /billers - Fetch Biller Directory', 14, y);
      y += 4;
      y = drawCodeBlock('Sample Response (200 OK)', `{\n  "status": "success",\n  "data": [\n    {\n      "billerId": "DGVCL0000GUJ01",\n      "billerName": "Dakshin Gujarat Vij Company Ltd (DGVCL)",\n      "category": "Electricity",\n      "customerParams": [{ "name": "Consumer Number", "type": "NUMERIC" }]\n    }\n  ]\n}`, y);

      // Section 2.4 POST /fetch-bill
      y = checkPageBreak(y, 110);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(79, 70, 229);
      doc.text('2.4 POST /fetch-bill - Fetch Customer Bill Details', 14, y);
      y += 4;
      y = drawCodeBlock('Sample Request Body', `{\n  "billerId": "DGVCL0000GUJ01",\n  "mobile": "9898971274",\n  "customerParams": [\n    { "name": "Consumer Number", "value": "12345678901" }\n  ]\n}`, y);
      y = drawCodeBlock('Sample Success Response (200 OK)', `{\n  "status": "success",\n  "message": "Bill fetched successfully",\n  "data": {\n    "responseCode": "000",\n    "responseReason": "Successful",\n    "fetchRequestId": "FETCH_REQ_987654321",\n    "billerResponse": {\n      "customerName": "AJAY KALATHIYA",\n      "amount": "1500.00",\n      "dueDate": "2026-08-30"\n    }\n  }\n}`, y);

      // Section 2.5 POST /pay-bill
      y = checkPageBreak(y, 140);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(79, 70, 229);
      doc.text('2.5 POST /pay-bill - Execute Bill Payment', 14, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        head: [['Parameter', 'Type', 'Required', 'Description']],
        body: [
          ['billerId', 'String', 'REQUIRED', 'Target Biller ID (e.g. DGVCL0000GUJ01)'],
          ['amount', 'Number', 'REQUIRED', 'Amount to be paid in Rupees (e.g. 1500.00)'],
          ['mobile', 'String', 'REQUIRED', '10-digit customer mobile number'],
          ['paymentMode', 'String', 'OPTIONAL', 'UPI, Internet Banking, Debit Card, Credit Card (Default: Cash)'],
          ['client_transaction_id', 'String', 'OPTIONAL', 'Custom transaction ID for idempotency and tracking'],
          ['customerParams', 'Array', 'REQUIRED', 'Array of { name, value } matching biller requirement'],
          ['billerResponseInfo', 'Object', 'OPTIONAL', 'Exact billerResponse object returned from /fetch-bill']
        ],
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 7.5 },
        margin: { left: 14, right: 14 }
      });
      y = (doc as any).lastAutoTable.finalY + 6;

      y = drawCodeBlock('Sample Request Body (/pay-bill)', `{\n  "billerId": "DGVCL0000GUJ01",\n  "amount": 1500.00,\n  "mobile": "9898971274",\n  "paymentMode": "UPI",\n  "client_transaction_id": "TXN_ORD_20260814_001",\n  "customerParams": [\n    { "name": "Consumer Number", "value": "12345678901" }\n  ]\n}`, y);
      y = drawCodeBlock('Sample Success Response (200 OK)', `{\n  "status": "success",\n  "message": "Bill Paid successfully",\n  "transaction_id": "BBPSU1283118228",\n  "client_transaction_id": "TXN_ORD_20260814_001",\n  "bbps_txn_ref_id": "CC016226CBAF13851712",\n  "payment_status": "success",\n  "charge_deducted": 10.00\n}`, y);

      // Section 2.6 GET /status/:transaction_id
      y = checkPageBreak(y, 130);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(16, 185, 129);
      doc.text('2.6 GET /status/:transaction_id - Check Live Status & Auto-Refund', 14, y);
      y += 4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('Pass BBPSU1283118228, TXN_ORD..., or CC01... ID. Pending transactions without CC01 ID auto-fail and auto-refund.', 14, y);
      y += 5;

      y = drawCodeBlock('Sample Success Response (200 OK)', `{\n  "status": "success",\n  "data": {\n    "transaction_id": "BBPSU1283118228",\n    "client_transaction_id": "TXN_ORD_20260814_001",\n    "bbps_txn_ref_id": "CC016226CBAF13851712",\n    "current_status": "success",\n    "bbps_status": "SUCCESS",\n    "polled_at": "2026-08-14T03:15:00.000Z"\n  }\n}`, y);

      y = drawCodeBlock('Sample Gateway Failure & Auto-Refund Response (No CC01 Generated)', `{\n  "status": "success",\n  "data": {\n    "transaction_id": "BBPSU1283118228",\n    "client_transaction_id": "TXN_ORD_20260814_001",\n    "bbps_txn_ref_id": "N/A",\n    "current_status": "failed",\n    "bbps_status": "FAILED_GATEWAY_ERROR",\n    "message": "Bill payment failed to connect to gateway. Wallet automatically refunded.",\n    "refund_status": "REFUNDED",\n    "refunded_amount": 1500.00\n  }\n}`, y);

      // Section 3: Error Codes Matrix Table
      y = checkPageBreak(y, 80);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(225, 29, 72);
      doc.text('3. HTTP Error Codes & Troubleshooting Matrix', 14, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        head: [['HTTP Code', 'Status', 'Description', 'Resolution Action']],
        body: [
          ['200 OK', 'success', 'Transaction / Request executed successfully', 'Process order response'],
          ['400 Bad Request', 'error', 'Insufficient Wallet Balance', 'Load funds into B2B wallet'],
          ['400 Bad Request', 'error', 'Payment mode Cash disabled for biller', 'Pass paymentMode: "UPI" or "Internet Banking"'],
          ['401 Unauthorized', 'error', 'Invalid API Keys or IP Not Whitelisted', 'Whitelist server IP in B2B Settings'],
          ['429 Too Many Requests', 'error', 'Daily sync limit reached (50 reqs/day)', 'Cache biller list locally'],
          ['500 Internal Error', 'error', 'Upstream Biller/Gateway Error', 'Wallet auto-refunded. Retry later']
        ],
        theme: 'grid',
        headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 7.5 },
        margin: { left: 14, right: 14 }
      });

      doc.save(`B2B_Bill_Payment_API_Documentation_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (err) {
      console.error('Failed to generate API PDF:', err);
      alert('Failed to generate PDF documentation');
    } finally {
      setExportingPdf(false);
    }
  };

  const CodeBlock = ({ title, code, section }: { title: string, code: string, section: string }) => (
    <div className="bg-slate-900 rounded-xl border border-slate-700/80 overflow-hidden my-4 shadow-xl">
      <div className="flex justify-between items-center px-4 py-2.5 bg-slate-800/90 border-b border-slate-700/80">
        <span className="text-xs font-mono font-semibold text-indigo-300">{title}</span>
        <button 
          onClick={() => copyToClipboard(code, section)}
          className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs bg-slate-700/50 hover:bg-slate-700 px-2.5 py-1 rounded-md"
        >
          {copiedSection === section ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-slate-300" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-4 overflow-x-auto">
        <pre className="text-xs font-mono text-emerald-400 leading-relaxed">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );

  const ParamTable = ({ params }: { params: { name: string, type: string, required: boolean, desc: string }[] }) => (
    <div className="overflow-x-auto my-4 rounded-xl border border-slate-700/80 shadow-lg">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-900/90 text-slate-300 border-b border-slate-700">
          <tr>
            <th className="px-4 py-3 font-semibold text-indigo-300">Parameter</th>
            <th className="px-4 py-3 font-semibold text-slate-400">Type</th>
            <th className="px-4 py-3 font-semibold text-slate-400">Required</th>
            <th className="px-4 py-3 font-semibold text-slate-400">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/50 bg-slate-900/40">
          {params.map((p, i) => (
            <tr key={i} className="hover:bg-slate-800/40 transition-colors">
              <td className="px-4 py-3 font-mono font-bold text-white">{p.name}</td>
              <td className="px-4 py-3 font-mono text-amber-300">{p.type}</td>
              <td className="px-4 py-3 font-semibold">
                {p.required ? (
                  <span className="bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded text-[10px]">REQUIRED</span>
                ) : (
                  <span className="bg-slate-700/50 text-slate-400 px-2 py-0.5 rounded text-[10px]">OPTIONAL</span>
                )}
              </td>
              <td className="px-4 py-3 text-slate-300 leading-normal">{p.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div id="b2b-api-doc-container" className="space-y-10 w-full text-slate-200 p-6 bg-slate-900 rounded-3xl">
      {/* Header Banner */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-40 bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-3">
              <Activity className="h-3.5 w-3.5 text-indigo-400" /> API v1.0 Documentation
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight mb-2">
              B2B Bill Payment API Reference
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
              High-performance, RESTful API documentation for processing utility bill payments, electricity bills, credit cards, fastag, and mobile recharges with real-time status tracking and automated webhook updates.
            </p>
          </div>
          <button
            data-html2canvas-ignore="true"
            onClick={handleExportPDF}
            disabled={exportingPdf}
            className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-sm shadow-xl border border-indigo-400/30 transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50 shrink-0 self-start md:self-center"
          >
            {exportingPdf ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4 text-white" />
                <span>Export PDF Doc</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Section 1: Authentication & Base URL */}
      <section className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-slate-700/80 pb-3">
          <Key className="h-5 w-5 text-indigo-400" />
          1. Authentication & Headers
        </h2>

        <p className="text-sm text-slate-300">
          All API requests must be transmitted securely over <strong>HTTPS</strong>. Authentication is performed by supplying your unique API credentials in HTTP headers for every request.
        </p>

        <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-700/70 space-y-2">
          <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider block">Base Endpoint URL</span>
          <code className="block text-indigo-300 font-mono text-sm font-bold">{baseUrl}/api/v1/b2b</code>
        </div>

        <div>
          <h3 className="font-semibold text-white text-sm mb-3">Mandatory HTTP Request Headers:</h3>
          <div className="overflow-x-auto rounded-xl border border-slate-700/80">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-semibold text-indigo-300">Header Name</th>
                  <th className="px-4 py-3 font-semibold text-slate-400">Value Format</th>
                  <th className="px-4 py-3 font-semibold text-slate-400">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 bg-slate-900/40">
                <tr>
                  <td className="px-4 py-3 font-mono font-bold text-emerald-400">x-api-key</td>
                  <td className="px-4 py-3 font-mono text-slate-300">String (e.g. pub_live_...)</td>
                  <td className="px-4 py-3 text-slate-300">Your B2B Public API Key issued from Agent Credentials portal.</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono font-bold text-emerald-400">x-secret-key</td>
                  <td className="px-4 py-3 font-mono text-slate-300">String (e.g. sec_live_...)</td>
                  <td className="px-4 py-3 text-slate-300">Your B2B Secret Key used to authenticate your system.</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono font-bold text-emerald-400">Content-Type</td>
                  <td className="px-4 py-3 font-mono text-slate-300">application/json</td>
                  <td className="px-4 py-3 text-slate-300">Required payload content type for POST requests.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-200 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="block mb-1 text-amber-300">IP Whitelisting Requirement:</strong>
            Requests originating from IP addresses that have not been explicitly whitelisted in your B2B Agent Settings will be rejected with an <code>HTTP 401 Unauthorized</code> status.
          </div>
        </div>
      </section>

      {/* Section 2: Endpoints Reference */}
      <section className="space-y-8">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Server className="h-5 w-5 text-indigo-400" />
          2. API Endpoints Reference
        </h2>

        {/* 2.1 GET /balance */}
        <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-3">
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider">GET</span>
              /balance
            </h3>
            <span className="text-xs text-slate-400 font-mono font-semibold">Check Agent Wallet Balance</span>
          </div>

          <p className="text-xs text-slate-300">Retrieve real-time available wallet balance for your API account.</p>

          <CodeBlock 
            title="Sample Response (200 OK)"
            section="balance_res"
            code={`{
  "status": "success",
  "data": {
    "agent_id": "b2b_agent_9843",
    "b2b_login_id": "mahida_1212",
    "company_name": "Mahida Enterprise",
    "balance": 25450.75,
    "currency": "INR"
  }
}`}
          />

          <ParamTable params={[
            { name: "status", type: "String", required: true, desc: "Status of request execution ('success' or 'error')." },
            { name: "data.balance", type: "Number", required: true, desc: "Current net available balance in Indian Rupees (₹)." },
            { name: "data.b2b_login_id", type: "String", required: true, desc: "Your registered B2B Agent login identifier." }
          ]} />
        </div>

        {/* 2.2 GET /categories */}
        <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-3">
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider">GET</span>
              /categories
            </h3>
            <span className="text-xs text-slate-400 font-mono font-semibold">List Biller Categories</span>
          </div>

          <p className="text-xs text-slate-300">Fetch all supported BBPS biller categories (Electricity, Water, Credit Card, Fastag, Gas, etc.).</p>

          <CodeBlock 
            title="Sample Response (200 OK)"
            section="cat_res"
            code={`{
  "status": "success",
  "data": [
    { "category_id": 1, "category_name": "Electricity" },
    { "category_id": 2, "category_name": "Mobile Postpaid" },
    { "category_id": 3, "category_name": "DTH" },
    { "category_id": 4, "category_name": "Water" },
    { "category_id": 5, "category_name": "Gas" },
    { "category_id": 6, "category_name": "Broadband" },
    { "category_id": 7, "category_name": "Credit Card" },
    { "category_id": 8, "category_name": "Fastag" }
  ]
}`}
          />
        </div>

        {/* 2.3 GET /billers */}
        <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-3">
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider">GET</span>
              /billers
            </h3>
            <span className="text-xs text-slate-400 font-mono font-semibold">Fetch Billers Directory</span>
          </div>

          <p className="text-xs text-slate-300">Fetch supported billers with required customer input parameters and validation metadata.</p>

          <ParamTable params={[
            { name: "category_id", type: "Number", required: false, desc: "Filter billers by category ID (e.g., 1 for Electricity)." },
            { name: "page", type: "Number", required: false, desc: "Page index for pagination (Default: 1)." },
            { name: "limit", type: "Number", required: false, desc: "Records per page (Max limit allowed: 500)." }
          ]} />

          <CodeBlock 
            title="Sample Response (200 OK)"
            section="billers_res"
            code={`{
  "status": "success",
  "data": [
    { 
      "biller_id": "DGVCL0000GUJ01", 
      "biller_name": "Dakshin Gujarat Vij Company Limited (DGVCL)",
      "category": "Electricity",
      "payment_modes": ["UPI", "Internet Banking", "Debit Card", "Credit Card"],
      "metadata": {
        "billerInputParams": {
          "paramInfo": [
            {
              "paramName": "Consumer Number",
              "dataType": "NUMERIC",
              "isOptional": "false",
              "minLength": 11,
              "maxLength": 11
            }
          ]
        }
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 100,
    "total_records": 1250,
    "total_pages": 13
  }
}`}
          />
        </div>

        {/* 2.4 POST /fetch-bill */}
        <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-3">
              <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider">POST</span>
              /fetch-bill
            </h3>
            <span className="text-xs text-slate-400 font-mono font-semibold">Fetch Customer Bill Amount</span>
          </div>

          <p className="text-xs text-slate-300">
            Query the biller's server in real time to fetch customer bill details, due date, customer name, and bill amount.
          </p>

          <ParamTable params={[
            { name: "billerId", type: "String", required: true, desc: "Exact Biller ID retrieved from the /billers API." },
            { name: "mobile", type: "String", required: true, desc: "10-digit customer mobile number." },
            { name: "customerParams", type: "Array of Objects", required: true, desc: "Array of { name, value } objects matching the biller's required input parameters." }
          ]} />

          <CodeBlock 
            title="Sample Request Body"
            section="fetch_req_code"
            code={`{
  "billerId": "DGVCL0000GUJ01",
  "mobile": "9898971274",
  "customerParams": [
    { "name": "Consumer Number", "value": "12345678901" }
  ]
}`}
          />

          <CodeBlock 
            title="Sample Success Response (200 OK)"
            section="fetch_res_code"
            code={`{
  "status": "success",
  "message": "Bill fetched successfully",
  "data": {
    "responseCode": "000",
    "responseReason": "Successful",
    "fetchRequestId": "FETCH_REQ_987654321",
    "billerResponse": {
      "customerName": "AJAY KALATHIYA",
      "amount": "1500.00",
      "billAmount": "150000",
      "dueDate": "2026-08-30",
      "billDate": "2026-08-10",
      "billNumber": "BLL-2026-08-9843",
      "billPeriod": "MONTHLY"
    },
    "additionalInfo": [
      { "infoName": "Minimum Payable Amount", "infoValue": "500.00" },
      { "infoName": "Total Due Amount", "infoValue": "1500.00" }
    ]
  }
}`}
          />
        </div>

        {/* 2.5 POST /pay-bill */}
        <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-36 bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />
          
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-3 relative z-10">
            <h3 className="text-lg font-bold text-white flex items-center gap-3">
              <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider">POST</span>
              /pay-bill
            </h3>
            <span className="text-xs text-slate-400 font-mono font-semibold">Execute Bill Payment</span>
          </div>

          <p className="text-xs text-slate-300 relative z-10">
            Execute the bill payment. Validates wallet balance, applies fee charges, deducts funds, and processes payment via BBPS gateway.
          </p>

          <div className="relative z-10">
            <h4 className="font-semibold text-white text-xs mb-2">Request Payload Parameters:</h4>
            <ParamTable params={[
              { name: "billerId", type: "String", required: true, desc: "Target Biller ID (e.g., 'DGVCL0000GUJ01', 'SBIC00000NATDN')." },
              { name: "amount", type: "Number", required: true, desc: "Amount to be paid in Rupees (e.g. 1500.00). Pass full bill amount or custom partial amount." },
              { name: "mobile", type: "String", required: true, desc: "10-digit customer mobile number." },
              { name: "paymentMode", type: "String", required: false, desc: "Payment mode: 'Cash', 'UPI', 'Internet Banking', 'Debit Card', 'Credit Card'. Default: 'Cash'. (Note: Electricity billers have 'Cash' disabled in BillAvenue, pass 'UPI' or 'Internet Banking')." },
              { name: "client_transaction_id", type: "String", required: false, desc: "Your system's unique transaction/order ID for idempotency & tracing. If omitted, a BBPSU... ID is auto-generated." },
              { name: "customerParams", type: "Array of Objects", required: true, desc: "Array of { name, value } matching required biller parameters." },
              { name: "customerPan", type: "String", required: false, desc: "Customer 10-digit PAN Card (e.g. 'ABCDE1234F'). MANDATORY for Cash payments of ₹50,000 or above as per RBI guidelines." },
              { name: "billerResponseInfo", type: "Object", required: false, desc: "Pass exact billerResponse object returned by /fetch-bill (customerName, billAmount, dueDate, billDate)." },
              { name: "additionalInfo", type: "Array of Objects", required: false, desc: "Optional metadata array like [{ infoName: 'Remark', infoValue: 'Payment' }]." }
            ]} />
          </div>

          <CodeBlock 
            title="Complete Request Payload Example"
            section="pay_req_full"
            code={`{
  "billerId": "DGVCL0000GUJ01",
  "amount": 1500.00,
  "mobile": "9898971274",
  "paymentMode": "UPI",
  "client_transaction_id": "TXN_ORD_20260814_001",
  "customerParams": [
    { "name": "Consumer Number", "value": "12345678901" }
  ],
  "billerResponseInfo": {
    "customerName": "AJAY KALATHIYA",
    "billAmount": "150000",
    "billDate": "2026-08-10",
    "dueDate": "2026-08-30"
  },
  "additionalInfo": [
    { "infoName": "Remark", "infoValue": "Monthly Electricity Bill Payment" }
  ]
}`}
          />

          <CodeBlock 
            title="Success Response (200 OK - Payment Processed Successfully)"
            section="pay_res_success"
            code={`{
  "status": "success",
  "message": "Bill Paid successfully",
  "transaction_id": "BBPSU1283118228",
  "client_transaction_id": "TXN_ORD_20260814_001",
  "payment_status": "success",
  "charge_deducted": 10.00,
  "data": {
    "responseCode": "000",
    "responseReason": "Successful",
    "ExtBillPayResponse": {
      "txnRefId": "CC016226CBAF13851712",
      "approvalRefNumber": "AB1234567890",
      "responseCode": "000",
      "responseReason": "Successful",
      "RespCustomerName": "AJAY KALATHIYA",
      "RespAmount": "150000",
      "txnStatus": "SUCCESS"
    }
  }
}`}
          />

          <CodeBlock 
            title="Pending Response (200 OK - Pending Confirmation at Biller End)"
            section="pay_res_pending"
            code={`{
  "status": "success",
  "message": "Transaction initiated, currently pending at biller",
  "transaction_id": "BBPSU9553347160",
  "client_transaction_id": "TXN_ORD_20260814_001",
  "payment_status": "pending",
  "charge_deducted": 10.00,
  "data": {
    "responseCode": "001",
    "responseReason": "Pending at Biller",
    "ExtBillPayResponse": {
      "txnRefId": "CC016226CBAF13848716",
      "txnStatus": "PENDING"
    }
  }
}`}
          />

          <CodeBlock 
            title="Error Response (400 Bad Request - Insufficient Wallet Balance)"
            section="pay_res_insufficient"
            code={`{
  "status": "error",
  "message": "Insufficient Wallet Balance. Required: ₹1510.00, Current Balance: ₹450.00"
}`}
          />

          <CodeBlock 
            title="Error Response (400 Bad Request - Disabled Payment Mode)"
            section="pay_res_disabled_mode"
            code={`{
  "status": "error",
  "message": "Payment mode Cash is disabled for this biller. Please pass paymentMode as 'UPI' or 'Internet Banking'."
}`}
          />
        </div>

        {/* 2.6 GET /status/:transaction_id */}
        <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-36 bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />

          <div className="flex items-center justify-between border-b border-slate-700/80 pb-3 relative z-10">
            <h3 className="text-lg font-bold text-white flex items-center gap-3">
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider">GET</span>
              /status/:transaction_id
            </h3>
            <span className="text-xs text-slate-400 font-mono font-semibold">Check Live Status</span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed relative z-10">
            Check live transaction status by passing your API Transaction ID (e.g. <code>BBPSU1283118228</code>), your Custom Client Transaction ID (e.g. <code>TXN_ORD_20260814_001</code>), or BillAvenue Ref ID (e.g. <code>CC01...</code>).
          </p>

          <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-4 space-y-2 relative z-10">
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
              <ShieldAlert className="h-4 w-4 text-indigo-400" />
              <span>Automatic Gateway Failure & Auto-Refund Policy</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-normal">
              If a transaction status is <code>pending</code> and no <code>CC01</code> Reference ID was generated (e.g. gateway socket error or network drop before hitting biller gateway), calling <code>/status/:transaction_id</code> automatically updates local database status to <code>failed</code> and performs an <strong>Immediate Automatic Refund</strong> back to your B2B Agent Wallet balance.
            </p>
          </div>

          <CodeBlock 
            title="Sample Success Response (200 OK)"
            section="status_res_code"
            code={`{
  "status": "success",
  "data": {
    "transaction_id": "BBPSU1283118228",
    "client_transaction_id": "TXN_ORD_20260814_001",
    "bbps_txn_ref_id": "CC016226CBAF13851712",
    "current_status": "success",
    "bbps_status": "SUCCESS",
    "polled_at": "2026-08-14T03:15:00.000Z"
  }
}`}
          />

          <CodeBlock 
            title="Sample Gateway Failure & Auto-Refund Response (200 OK - No CC01 Generated)"
            section="status_res_auto_refund"
            code={`{
  "status": "success",
  "data": {
    "transaction_id": "BBPSU1283118228",
    "client_transaction_id": "TXN_ORD_20260814_001",
    "bbps_txn_ref_id": "N/A",
    "current_status": "failed",
    "bbps_status": "FAILED_GATEWAY_ERROR",
    "message": "Bill payment failed to connect to biller gateway (No CC01 Ref generated). Agent wallet has been automatically refunded.",
    "refund_status": "REFUNDED",
    "refunded_amount": 1500.00,
    "polled_at": "2026-08-14T03:15:00.000Z"
  }
}`}
          />
        </div>

        {/* 2.7 GET /admin-bank-accounts */}
        <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-3">
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider">GET</span>
              /admin-bank-accounts
            </h3>
            <span className="text-xs text-slate-400 font-mono font-semibold">Get Admin Bank Accounts List</span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Retrieve active company bank accounts configured by B2B Admin. External portals (Zenot Portal) can render these accounts in a dropdown list for the agent to select their deposit destination.
          </p>

          <CodeBlock 
            title="Sample Response (200 OK)"
            section="admin_banks_res"
            code={`{
  "status": "success",
  "data": [
    {
      "bank_account_id": "a98e21bc-1234-4567-89ab-cdef01234567",
      "bank_name": "ICICI Bank",
      "account_name": "Rajwadi Enterprises Pvt Ltd",
      "account_number": "50200012345678",
      "ifsc_code": "ICIC0005020",
      "branch_name": "Rajkot Main Branch",
      "upi_id": "rajwadi@icici"
    }
  ]
}`}
          />
        </div>

        {/* 2.8 POST /fund-request */}
        <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-3">
              <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider">POST</span>
              /fund-request
            </h3>
            <span className="text-xs text-slate-400 font-mono font-semibold">Submit B2B Fund Request</span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Submit a wallet fund request electronically from third-party client portals (e.g. Zenot Portal). Your request will be queued in <code>pending</code> status for B2B Admin approval.
          </p>

          <CodeBlock 
            title="Sample Request Body"
            section="fund_req_body"
            code={`{
  "amount": 50000,
  "utr_number": "UTR9876543210",
  "admin_bank_account_id": "a98e21bc-1234-4567-89ab-cdef01234567",
  "proof_url": "https://example.com/payment_receipt.jpg"
}`}
          />

          <CodeBlock 
            title="Sample Success Response (201 Created)"
            section="fund_req_res"
            code={`{
  "status": "success",
  "message": "Fund request submitted successfully and pending approval",
  "data": {
    "request_id": "88a912bc-9430-4e2b-8a2b-103bc4a9192b",
    "amount": 50000,
    "utr_number": "UTR9876543210",
    "status": "pending",
    "submitted_at": "2026-08-15T00:33:00.000Z"
  }
}`}
          />

          <ParamTable params={[
            { name: "amount", type: "Number", required: true, desc: "Amount in INR (₹) requested to add to your B2B wallet." },
            { name: "utr_number", type: "String", required: true, desc: "Unique Bank Transaction Reference / UTR Number (also accepts 'transaction_ref_no')." },
            { name: "admin_bank_account_id", type: "String", required: false, desc: "Optional ID of the Admin Bank Account where money was deposited (obtained from GET /admin-bank-accounts)." },
            { name: "proof_url", type: "String", required: false, desc: "Optional URL linking to payment receipt or transaction screenshot." }
          ]} />
        </div>

        {/* 2.9 GET /fund-request/status/:request_id */}
        <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-3">
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider">GET</span>
              /fund-request/status/:request_id
            </h3>
            <span className="text-xs text-slate-400 font-mono font-semibold">Check Fund Request Status</span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Check the live approval status (<code>pending</code>, <code>approved</code>, <code>rejected</code>) of a submitted fund request.
          </p>

          <CodeBlock 
            title="Sample Response (200 OK)"
            section="fund_req_status_res"
            code={`{
  "status": "success",
  "data": {
    "request_id": "88a912bc-9430-4e2b-8a2b-103bc4a9192b",
    "amount": 50000,
    "utr_number": "UTR9876543210",
    "status": "approved",
    "proof_url": null,
    "created_at": "2026-08-15T00:33:00.000Z",
    "updated_at": "2026-08-15T00:35:00.000Z"
  }
}`}
          />
        </div>

      </section>

      {/* Section 3: Multi-Language Code Snippets */}
      <section className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-slate-700/80 pb-3">
          <Code className="h-5 w-5 text-indigo-400" />
          3. Code Integration Examples
        </h2>

        <div className="flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-xl border border-slate-700/70 w-fit">
          <button
            onClick={() => setActiveLang('curl')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeLang === 'curl' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            cURL
          </button>
          <button
            onClick={() => setActiveLang('nodejs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeLang === 'nodejs' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Node.js (Axios)
          </button>
          <button
            onClick={() => setActiveLang('python')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeLang === 'python' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Python (Requests)
          </button>
          <button
            onClick={() => setActiveLang('php')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeLang === 'php' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            PHP (cURL)
          </button>
        </div>

        {activeLang === 'curl' && (
          <CodeBlock 
            title="cURL Request Example (/pay-bill)"
            section="code_curl"
            code={`curl -X POST "${baseUrl}/api/v1/b2b/pay-bill" \\
  -H "x-api-key: pub_live_your_key_here" \\
  -H "x-secret-key: sec_live_your_secret_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "billerId": "DGVCL0000GUJ01",
    "amount": 1500.00,
    "mobile": "9898971274",
    "paymentMode": "UPI",
    "client_transaction_id": "TXN_ORD_98431",
    "customerParams": [
      { "name": "Consumer Number", "value": "12345678901" }
    ]
  }'`}
          />
        )}

        {activeLang === 'nodejs' && (
          <CodeBlock 
            title="Node.js Integration Example (Axios)"
            section="code_nodejs"
            code={`const axios = require('axios');

async function payBill() {
  try {
    const response = await axios.post('${baseUrl}/api/v1/b2b/pay-bill', {
      billerId: 'DGVCL0000GUJ01',
      amount: 1500.00,
      mobile: '9898971274',
      paymentMode: 'UPI',
      client_transaction_id: 'TXN_ORD_98431',
      customerParams: [
        { name: 'Consumer Number', value: '12345678901' }
      ]
    }, {
      headers: {
        'x-api-key': 'pub_live_your_key_here',
        'x-secret-key': 'sec_live_your_secret_here',
        'Content-Type': 'application/json'
      }
    });

    console.log('Payment Status:', response.data.payment_status);
    console.log('Txn Ref ID:', response.data.data?.ExtBillPayResponse?.txnRefId);
  } catch (error) {
    console.error('Payment Error:', error.response?.data || error.message);
  }
}

payBill();`}
          />
        )}

        {activeLang === 'python' && (
          <CodeBlock 
            title="Python Integration Example (Requests)"
            section="code_python"
            code={`import requests

url = "${baseUrl}/api/v1/b2b/pay-bill"
headers = {
    "x-api-key": "pub_live_your_key_here",
    "x-secret-key": "sec_live_your_secret_here",
    "Content-Type": "application/json"
}

payload = {
    "billerId": "DGVCL0000GUJ01",
    "amount": 1500.00,
    "mobile": "9898971274",
    "paymentMode": "UPI",
    "client_transaction_id": "TXN_ORD_98431",
    "customerParams": [
        {"name": "Consumer Number", "value": "12345678901"}
    ]
}

response = requests.post(url, json=payload, headers=headers)
data = response.json()
print("Payment Result:", data)`}
          />
        )}

        {activeLang === 'php' && (
          <CodeBlock 
            title="PHP Integration Example (cURL)"
            section="code_php"
            code={`<?php
$ch = curl_init("${baseUrl}/api/v1/b2b/pay-bill");

$payload = json_encode([
    "billerId" => "DGVCL0000GUJ01",
    "amount" => 1500.00,
    "mobile" => "9898971274",
    "paymentMode" => "UPI",
    "client_transaction_id" => "TXN_ORD_98431",
    "customerParams" => [
        ["name" => "Consumer Number", "value" => "12345678901"]
    ]
]);

curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'x-api-key: pub_live_your_key_here',
    'x-secret-key: sec_live_your_secret_here',
    'Content-Type: application/json'
]);

$response = curl_exec($ch);
curl_close($ch);

$result = json_decode($response, true);
var_dump($result);
?>`}
          />
        )}
      </section>

      {/* Section 4: Webhooks Section */}
      <section className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-slate-700/80 pb-3">
          <Activity className="h-5 w-5 text-indigo-400" />
          4. Webhook Notifications (Asynchronous Callbacks)
        </h2>

        <p className="text-xs text-slate-300">
          When a transaction is initiated and returns a <code>pending</code> status, our background engine continuously polls BBPS. Once confirmed by the biller as <strong>Success</strong> or <strong>Failed</strong>, a HTTP POST callback is dispatched to your configured Webhook URL.
        </p>

        <CodeBlock 
          title="Webhook Payload Example (Transaction Success)"
          section="webhook_success_payload"
          code={`{
  "event": "PAYMENT_STATUS_UPDATE",
  "transaction_id": "BBPSU9553347160",
  "client_transaction_id": "TXN_ORD_20260814_001",
  "bbps_txn_ref_id": "CC016226CBAF13848716",
  "status": "success",
  "amount": 1500.00,
  "charge_deducted": 10.00,
  "bbps_status": "SUCCESS",
  "refunded": false,
  "timestamp": "2026-08-14T02:25:00.000Z"
}`}
        />

        <CodeBlock 
          title="Webhook Payload Example (Transaction Failed & Instant Refunded)"
          section="webhook_failed_payload"
          code={`{
  "event": "PAYMENT_STATUS_UPDATE",
  "transaction_id": "BBPSU9553347160",
  "client_transaction_id": "TXN_ORD_20260814_001",
  "bbps_txn_ref_id": "CC016226CBAF13848716",
  "status": "failed",
  "amount": 1500.00,
  "charge_deducted": 0,
  "bbps_status": "FAILED",
  "refunded": true,
  "refund_amount": 1510.00,
  "timestamp": "2026-08-14T02:25:00.000Z"
}`}
        />

        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-xs text-emerald-200 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <strong className="block mb-1 text-emerald-300">Automated Wallet Refund Guarantee:</strong>
            If a pending transaction is subsequently marked as <code>FAILED</code> by BBPS, the system automatically refunds 100% of the principal bill amount AND charge fee back to your agent wallet instantly.
          </div>
        </div>
      </section>

      {/* Section 5: HTTP & Error Codes Matrix */}
      <section className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-slate-700/80 pb-3">
          <AlertCircle className="h-5 w-5 text-rose-400" />
          5. Error Codes & Troubleshooting Matrix
        </h2>

        <div className="overflow-x-auto rounded-xl border border-slate-700/80">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-300">
              <tr>
                <th className="px-4 py-3 font-semibold text-rose-400">HTTP Status</th>
                <th className="px-4 py-3 font-semibold text-indigo-300">Response Status</th>
                <th className="px-4 py-3 font-semibold text-slate-400">Error Description & Root Cause</th>
                <th className="px-4 py-3 font-semibold text-slate-400">Recommended Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 bg-slate-900/40">
              <tr className="hover:bg-slate-800/40">
                <td className="px-4 py-3 font-mono font-bold text-rose-400">400 Bad Request</td>
                <td className="px-4 py-3 font-mono text-rose-300">error</td>
                <td className="px-4 py-3 text-slate-300">Insufficient Wallet Balance to cover bill amount + fee.</td>
                <td className="px-4 py-3 text-slate-300">Load funds into your B2B Agent wallet and retry.</td>
              </tr>
              <tr className="hover:bg-slate-800/40">
                <td className="px-4 py-3 font-mono font-bold text-rose-400">400 Bad Request</td>
                <td className="px-4 py-3 font-mono text-rose-300">error</td>
                <td className="px-4 py-3 text-slate-300">Payment mode 'Cash' disabled by biller.</td>
                <td className="px-4 py-3 text-slate-300">Pass <code>paymentMode: "UPI"</code> or <code>"Internet Banking"</code>.</td>
              </tr>
              <tr className="hover:bg-slate-800/40">
                <td className="px-4 py-3 font-mono font-bold text-amber-400">401 Unauthorized</td>
                <td className="px-4 py-3 font-mono text-amber-300">error</td>
                <td className="px-4 py-3 text-slate-300">Invalid API/Secret Keys or IP address not whitelisted.</td>
                <td className="px-4 py-3 text-slate-300">Verify credentials and whitelist server IP in B2B settings.</td>
              </tr>
              <tr className="hover:bg-slate-800/40">
                <td className="px-4 py-3 font-mono font-bold text-amber-400">429 Rate Limit</td>
                <td className="px-4 py-3 font-mono text-amber-300">error</td>
                <td className="px-4 py-3 text-slate-300">Daily limit of 50 sync requests reached for /billers endpoint.</td>
                <td className="px-4 py-3 text-slate-300">Cache biller directory locally and sync once daily.</td>
              </tr>
              <tr className="hover:bg-slate-800/40">
                <td className="px-4 py-3 font-mono font-bold text-rose-400">500 Server Error</td>
                <td className="px-4 py-3 font-mono text-rose-300">error</td>
                <td className="px-4 py-3 text-slate-300">Upstream Biller or Gateway Timeout / System Down.</td>
                <td className="px-4 py-3 text-slate-300">Wallet is auto-refunded. Retry after a few minutes.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

