import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Book, Code, Key, Server, AlertCircle, Copy, CheckCircle2, 
  Activity, ShieldAlert, DollarSign, Layers, Globe, 
  FileText, ChevronRight, Check, Download, Zap, ArrowRightLeft, 
  Landmark, UserCheck, Eye, ShieldCheck, Sparkles 
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

export default function B2BAPIDocumentation() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState<'curl' | 'nodejs' | 'python' | 'php'>('curl');
  const [exportingPdf, setExportingPdf] = useState(false);

  // Dynamic Service Permissions & Filtering
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [agentName, setAgentName] = useState<string>('B2B Partner');
  const [isBbpsEnabled, setIsBbpsEnabled] = useState(true);
  const [isPayoutEnabled, setIsPayoutEnabled] = useState(false);
  const [isCsplEnabled, setIsCsplEnabled] = useState(false);
  const [activeService, setActiveService] = useState<'bbps' | 'payout' | 'cspl'>('bbps');
  const [docFundWallet, setDocFundWallet] = useState<'bbps' | 'payout' | 'cspl'>('bbps');

  useEffect(() => {
    if (activeService === 'cspl') setDocFundWallet('cspl');
    else if (activeService === 'payout') setDocFundWallet('payout');
    else setDocFundWallet('bbps');
  }, [activeService]);

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://api.usepay.in';

  // Load Agent Permissions or Admin Status
  useEffect(() => {
    const adminCheck = typeof window !== 'undefined' && window.location.pathname.startsWith('/b2b/admin');
    setIsAdmin(adminCheck);

    const agentId = typeof window !== 'undefined' ? localStorage.getItem('b2bAgentId') : null;
    const urlService = searchParams.get('service');

    if (adminCheck) {
      setIsBbpsEnabled(true);
      setIsPayoutEnabled(true);
      setIsCsplEnabled(true);
      if (urlService === 'cspl') {
        setActiveService('cspl');
      } else if (urlService === 'payout') {
        setActiveService('payout');
      } else {
        setActiveService('bbps');
      }
      setLoadingPermissions(false);
    } else if (agentId) {
      const fetchPermissions = async () => {
        try {
          const { data, error } = await supabase
            .from('b2b_api_credentials')
            .select('first_name, last_name, b2b_login_id, is_bbps_enabled, is_payout_enabled, is_cspl_enabled')
            .eq('id', agentId)
            .maybeSingle();

          if (error) {
            console.error('Error fetching agent API credentials:', error);
          } else if (data) {
            const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ').trim();
            const resolvedName = fullName || data.b2b_login_id || 'B2B Partner';
            setAgentName(resolvedName);

            const bbps = data.is_bbps_enabled !== false;
            const payout = !!data.is_payout_enabled;
            const cspl = !!data.is_cspl_enabled;
            setIsBbpsEnabled(bbps);
            setIsPayoutEnabled(payout);
            setIsCsplEnabled(cspl);

            // Determine initial active service
            if (urlService === 'cspl' && cspl) {
              setActiveService('cspl');
            } else if (urlService === 'payout' && payout) {
              setActiveService('payout');
            } else if (urlService === 'bbps' && bbps) {
              setActiveService('bbps');
            } else if (cspl && !bbps && !payout) {
              setActiveService('cspl');
              setSearchParams({ service: 'cspl' }, { replace: true });
            } else if (payout && !bbps && !cspl) {
              setActiveService('payout');
              setSearchParams({ service: 'payout' }, { replace: true });
            } else if (bbps) {
              setActiveService('bbps');
              setSearchParams({ service: 'bbps' }, { replace: true });
            }
          }
        } catch (err) {
          console.error('Error fetching agent API credentials:', err);
        } finally {
          setLoadingPermissions(false);
        }
      };

      fetchPermissions();
    } else {
      setLoadingPermissions(false);
    }
  }, []);

  // Sync activeService if URL search params change
  useEffect(() => {
    const urlService = searchParams.get('service');
    if (urlService === 'cspl' && (isCsplEnabled || isAdmin)) {
      setActiveService('cspl');
    } else if (urlService === 'payout' && (isPayoutEnabled || isAdmin)) {
      setActiveService('payout');
    } else if (urlService === 'bbps' && (isBbpsEnabled || isAdmin)) {
      setActiveService('bbps');
    }
  }, [searchParams, isBbpsEnabled, isPayoutEnabled, isCsplEnabled, isAdmin]);

  const handleSelectService = (service: 'bbps' | 'payout' | 'cspl') => {
    setActiveService(service);
    setSearchParams({ service }, { replace: true });
  };

  const hasMultipleServices = [isBbpsEnabled, isPayoutEnabled, isCsplEnabled].filter(Boolean).length > 1 || isAdmin;

  // Dedicated PDF Export Function for the active service
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

      const docTitle = activeService === 'payout' 
        ? 'B2B Instant Payout API Reference' 
        : 'B2B Bill Payment API Reference';

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
          drawHeader(`${docTitle} (Contd.)`);
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
      drawHeader(docTitle);
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

      // Section 2: Endpoints Overview Table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text('2. Enabled API Endpoints Overview', 14, y);
      y += 4;

      const endpointRows: string[][] = [
        ['GET', '/balance', `Fetch current available agent ${activeService === 'cspl' ? 'CSPL' : activeService === 'payout' ? 'Payout' : 'BBPS'} wallet balance in Rupees`]
      ];

      if (activeService === 'cspl') {
        endpointRows.push(
          ['POST', '/cspl/biller-info', 'Fetch real-time CSPL biller information & required input parameters'],
          ['POST', '/cspl/fetch-bill', 'Instant JSON bill fetch with live dues, bill date & customer name'],
          ['POST', '/cspl/pay-bill', 'Sub-second fast bill pay deducting from CSPL Wallet with auto-refund'],
          ['GET', '/cspl/status/:transaction_id', 'Query real-time status of a CSPL bill payment transaction'],
          ['GET', '/admin-bank-accounts', 'Fetch company bank accounts for CSPL wallet top-up'],
          ['POST', '/fund-request', 'Submit electronic fund request (wallet_type: "cspl")'],
          ['GET', '/fund-request/status/:request_id', 'Check real-time approval status of submitted fund request']
        );
      } else if (activeService === 'bbps') {
        endpointRows.push(
          ['GET', '/categories', 'Fetch supported biller categories (Electricity, Fastag, Water, etc.)'],
          ['GET', '/billers', 'Fetch billers list and required customer input parameters'],
          ['POST', '/fetch-bill', 'Fetch customer bill amount, due date, and biller details'],
          ['POST', '/pay-bill', 'Process bill payment and deduct funds from agent BBPS wallet'],
          ['GET', '/status/:transaction_id', 'Check real-time live status & auto-refund of a bill payment'],
          ['GET', '/admin-bank-accounts', 'Fetch company bank accounts for wallet fund top-up'],
          ['POST', '/fund-request', 'Submit electronic fund request (wallet_type: "bbps")'],
          ['GET', '/fund-request/status/:request_id', 'Check real-time approval status of submitted fund request']
        );
      } else {
        endpointRows.push(
          ['POST', '/payout/transfer', 'Execute 24x7 instant bank transfer via IMPS or NEFT'],
          ['GET', '/payout/status/:order_id', 'Check real-time live payout transfer status & bank UTR'],
          ['GET', '/admin-bank-accounts', 'Fetch company bank accounts for payout wallet top-up'],
          ['POST', '/fund-request', 'Submit electronic fund request (wallet_type: "payout")'],
          ['GET', '/fund-request/status/:request_id', 'Check real-time approval status of submitted fund request']
        );
      }

      autoTable(doc, {
        startY: y,
        head: [['Method', 'Endpoint Path', 'Description']],
        body: endpointRows,
        theme: 'grid',
        headStyles: { 
          fillColor: activeService === 'payout' ? [147, 51, 234] : [16, 185, 129], 
          textColor: [255, 255, 255], 
          fontStyle: 'bold', 
          fontSize: 8.5 
        },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 }
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      // 2.1 GET /balance
      y = checkPageBreak(y, 45);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(79, 70, 229);
      doc.text('2.1 GET /balance - Check Agent Wallet Balance', 14, y);
      y += 4;
      y = drawCodeBlock('Sample Response (200 OK)', `{\n  "status": "success",\n  "data": {\n    "balance": 25450.75,\n    "bbps_wallet_balance": 15450.75,\n    "payout_wallet_balance": 10000.00,\n    "is_bbps_enabled": ${isBbpsEnabled},\n    "is_payout_enabled": ${isPayoutEnabled}\n  }\n}`, y);

      // PURE BBPS SECTIONS IN PDF
      if (activeService === 'bbps') {
        y = checkPageBreak(y, 65);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(79, 70, 229);
        doc.text('2.2 GET /categories - Fetch Biller Categories', 14, y);
        y += 4;
        y = drawCodeBlock('Sample Response (200 OK)', `{\n  "status": "success",\n  "data": [\n    { "category_name": "Electricity", "code": "ELECTRICITY" },\n    { "category_name": "Fastag", "code": "FASTAG" },\n    { "category_name": "Credit Card", "code": "CREDIT_CARD" }\n  ]\n}`, y);

        y = checkPageBreak(y, 90);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(79, 70, 229);
        doc.text('2.3 POST /fetch-bill - Fetch Customer Bill Details', 14, y);
        y += 4;
        y = drawCodeBlock('Sample Request Body', `{\n  "billerId": "DGVCL0000GUJ01",\n  "mobile": "9898971274",\n  "customerParams": [{ "name": "Consumer Number", "value": "12345678901" }]\n}`, y);
        y = drawCodeBlock('Sample Success Response (200 OK)', `{\n  "status": "success",\n  "data": {\n    "responseCode": "000",\n    "billerResponse": { "customerName": "AJAY KALATHIYA", "amount": "1500.00", "dueDate": "2026-08-30" }\n  }\n}`, y);

        y = checkPageBreak(y, 110);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(79, 70, 229);
        doc.text('2.4 POST /pay-bill - Execute Bill Payment', 14, y);
        y += 4;
        y = drawCodeBlock('Sample Request Body', `{\n  "billerId": "DGVCL0000GUJ01",\n  "amount": 1500.00,\n  "mobile": "9898971274",\n  "paymentMode": "UPI",\n  "client_transaction_id": "TXN_ORD_20260814_001",\n  "customerParams": [{ "name": "Consumer Number", "value": "12345678901" }]\n}`, y);
        y = drawCodeBlock('Sample Success Response (200 OK)', `{\n  "status": "success",\n  "payment_status": "success",\n  "message": "Bill Paid successfully",\n  "transaction_id": "BBPSU1283118228",\n  "charge_deducted": 10.00\n}`, y);
        y = drawCodeBlock('Sample Pending Response (202 Accepted)', `{\n  "status": "pending",\n  "payment_status": "pending",\n  "message": "Transaction initiated, currently pending at biller",\n  "transaction_id": "BBPSU1283118228"\n}`, y);

        y = checkPageBreak(y, 75);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(16, 185, 129);
        doc.text('2.5 GET /status/:transaction_id - Live Status & Auto-Refund', 14, y);
        y += 4;
        y = drawCodeBlock('Sample Status Response (200 OK / 202 Accepted)', `{\n  "status": "pending",\n  "payment_status": "pending",\n  "data": {\n    "transaction_id": "BBPSU1283118228",\n    "client_transaction_id": "TXN_ORD_20260814_001",\n    "current_status": "pending",\n    "status": "pending",\n    "payment_status": "pending",\n    "bbps_status": "PENDING"\n  }\n}`, y);

        y = checkPageBreak(y, 85);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(79, 70, 229);
        doc.text('2.6 POST /fund-request - Submit BBPS Wallet Top-up (wallet_type: "bbps")', 14, y);
        y += 4;
        y = drawCodeBlock('Sample Request Body', `{\n  "amount": 50000,\n  "utr_number": "UTR9876543210",\n  "wallet_type": "bbps",\n  "admin_bank_account_id": "a98e21bc-1234-4567-89ab-cdef01234567"\n}`, y);
      } else if (activeService === 'cspl') {
        // PURE CSPL SECTIONS IN PDF
        y = checkPageBreak(y, 90);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(59, 130, 246);
        doc.text('2.2 POST /cspl/fetch-bill - Fetch Customer Bill Details', 14, y);
        y += 4;
        y = drawCodeBlock('Sample Request Body', `{\n  "billerId": "DGVCL0000GUJ01",\n  "mobile": "9898971274",\n  "customerParams": [{ "name": "Consumer Number", "value": "12345678901" }]\n}`, y);

        y = checkPageBreak(y, 110);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(59, 130, 246);
        doc.text('2.3 POST /cspl/pay-bill - Execute Sub-second Bill Payment', 14, y);
        y += 4;
        y = drawCodeBlock('Sample Request Body', `{\n  "billerId": "DGVCL0000GUJ01",\n  "amount": 1500.00,\n  "mobile": "9898971274",\n  "client_transaction_id": "TXN_CSPL_20261003_001",\n  "customerParams": [{ "name": "Consumer Number", "value": "12345678901" }]\n}`, y);

        y = checkPageBreak(y, 85);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(59, 130, 246);
        doc.text('2.4 POST /fund-request - Submit CSPL Wallet Top-up (wallet_type: "cspl")', 14, y);
        y += 4;
        y = drawCodeBlock('Sample Request Body', `{\n  "amount": 50000,\n  "utr_number": "UTR9876543210",\n  "wallet_type": "cspl",\n  "admin_bank_account_id": "a98e21bc-1234-4567-89ab-cdef01234567"\n}`, y);
      } else {
        // PURE PAYOUT SECTIONS IN PDF
        y = checkPageBreak(y, 110);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(147, 51, 234);
        doc.text('2.2 POST /payout/transfer - 24x7 Instant Bank Transfer', 14, y);
        y += 4;
        y = drawCodeBlock('Sample Request Body', `{\n  "amount": 2500.00,\n  "account_number": "91234567890123",\n  "ifsc_code": "HDFC0001234",\n  "beneficiary_name": "Ramesh Kumar",\n  "transfer_mode": "IMPS",\n  "client_order_id": "ORD_PAYOUT_1001"\n}`, y);
        y = drawCodeBlock('Sample Success Response (200 OK)', `{\n  "status": "success",\n  "message": "Payout transfer completed successfully",\n  "data": {\n    "order_id": "B2BPO1727443912001",\n    "client_order_id": "ORD_PAYOUT_1001",\n    "utr": "426812831122",\n    "amount": 2500.00,\n    "base_fee": 25.00,\n    "gst": 4.50,\n    "fee": 29.50,\n    "total_deducted": 2529.50,\n    "status": "success"\n  }\n}`, y);

        y = checkPageBreak(y, 75);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(147, 51, 234);
        doc.text('2.3 GET /payout/status/:order_id - Live Payout Status & UTR', 14, y);
        y += 4;
        y = drawCodeBlock('Sample Status Response (200 OK)', `{\n  "status": "success",\n  "data": {\n    "order_id": "B2BPO1727443912001",\n    "client_order_id": "ORD_PAYOUT_1001",\n    "utr": "426812831122",\n    "beneficiary_name": "Ramesh Kumar",\n    "status": "success"\n  }\n}`, y);

        y = checkPageBreak(y, 85);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(147, 51, 234);
        doc.text('2.4 POST /fund-request - Submit Payout Wallet Top-up (wallet_type: "payout")', 14, y);
        y += 4;
        y = drawCodeBlock('Sample Request Body', `{\n  "amount": 50000,\n  "utr_number": "UTR9876543210",\n  "wallet_type": "payout",\n  "admin_bank_account_id": "a98e21bc-1234-4567-89ab-cdef01234567"\n}`, y);
      }

      // Error Codes Matrix
      y = checkPageBreak(y, 80);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(225, 29, 72);
      doc.text('3. Error Codes & Troubleshooting Matrix', 14, y);
      y += 4;

      const errorRows: string[][] = [
        ['200 OK', 'success', 'Request processed successfully', 'Parse response data payload'],
        ['202 Accepted', 'pending', 'Transaction initiated & currently pending at biller', 'Save as PENDING. Poll status or wait for Webhook'],
        ['400 Bad Request', 'error', `Insufficient ${activeService === 'payout' ? 'Payout' : 'BBPS'} Wallet Balance`, `Submit /fund-request with wallet_type: "${activeService}"`]
      ];

      if (activeService === 'payout') {
        errorRows.push(
          ['400 Bad Request', 'failed', 'Invalid IFSC / Beneficiary Account Inactive', 'Verify bank details. Auto-refunded to payout wallet']
        );
      } else {
        errorRows.push(
          ['400 Bad Request', 'failed', 'Payment failed at biller gateway', 'Funds auto-refunded to BBPS wallet. Do not deliver service'],
          ['400 Bad Request', 'error', 'Payment mode Cash disabled by biller', 'Pass paymentMode: "UPI" or "Internet Banking"']
        );
      }

      errorRows.push(
        ['401 Unauthorized', 'error', 'Invalid API Keys or IP Not Whitelisted', 'Whitelist server IP in Settings'],
        ['429 Too Many Requests', 'error', 'Rate limit exceeded', 'Implement caching & rate-limiting'],
        ['500 Server Error', 'error', 'Upstream Bank/Gateway Timeout', 'Wallet auto-refunded. Query status']
      );

      autoTable(doc, {
        startY: y,
        head: [['HTTP Code', 'Status', 'Description', 'Resolution Action']],
        body: errorRows,
        theme: 'grid',
        headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 7.5 },
        margin: { left: 14, right: 14 }
      });

      const sanitizedFilename = docTitle.replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`${sanitizedFilename}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
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

  if (loadingPermissions) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-300 gap-3">
        <LoadingSpinner size="lg" />
        <p className="text-sm">Loading API Documentation and service permissions...</p>
      </div>
    );
  }

  // Edge case: No services enabled
  if (!isBbpsEnabled && !isPayoutEnabled && !isAdmin) {
    return (
      <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 text-center space-y-4">
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl max-w-md mx-auto">
          <AlertCircle className="h-8 w-8 text-rose-400 mx-auto mb-2" />
          <h2 className="text-lg font-bold text-white">No Services Currently Active</h2>
          <p className="text-xs text-slate-400 mt-2">
            Neither Bill Payment (BBPS) nor Instant Payout API is currently enabled for your account. Please contact your B2B administrator to activate services.
          </p>
        </div>
      </div>
    );
  }

  // Dynamic header titles based on the active service
  const isPayout = activeService === 'payout';
  const isCspl = activeService === 'cspl';
  const isBbps = activeService === 'bbps';

  const pageTitle = isCspl
    ? 'B2B CSPL Fast Bill Payment API Reference'
    : isPayout 
      ? 'B2B Instant Payout API Reference' 
      : 'B2B Bill Payment (BBPS) API Reference';

  const pageDescription = isCspl
    ? 'Ultra-fast, JSON-native Bill Payment API powered by CSPL Camlenio BBPS gateway with sub-second execution, dedicated CSPL wallet, instant bill fetch, and automatic refunds on banking failure.'
    : isPayout 
      ? '24x7 Real-time automated bank account transfer API via IMPS / NEFT with dedicated payout wallet, live status checking, and automatic refunds on banking failure.' 
      : 'High-performance, RESTful API documentation for processing utility bill payments, electricity bills, credit cards, fastag, and mobile recharges with real-time status tracking and automated webhook updates.';

  return (
    <div id="b2b-api-doc-container" className="space-y-8 w-full text-slate-200 p-4 md:p-6 bg-slate-900 rounded-3xl">
      {/* SEPARATE SERVICE SWITCHER TABS (Shown if agent has multiple services, or admin) */}
      {hasMultipleServices && (
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-2.5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            {isBbpsEnabled && (
              <button
                type="button"
                onClick={() => handleSelectService('bbps')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${
                  activeService === 'bbps' 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400/30' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                <Landmark className="h-4 w-4" />
                Bill Payment (BBPS) API
              </button>
            )}

            {isPayoutEnabled && (
              <button
                type="button"
                onClick={() => handleSelectService('payout')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${
                  activeService === 'payout' 
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 ring-2 ring-purple-400/30' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                <Zap className="h-4 w-4" />
                Instant Payout API
              </button>
            )}

            {isCsplEnabled && (
              <button
                type="button"
                onClick={() => handleSelectService('cspl')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${
                  activeService === 'cspl' 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-400/30' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                <Zap className="h-4 w-4" />
                CSPL Fast Bill API
              </button>
            )}
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-2 self-end sm:self-center">
            <Eye className="h-4 w-4 text-indigo-400" />
            <span>Active Documentation: <strong className={isCspl ? 'text-blue-400' : isPayout ? 'text-purple-400' : 'text-emerald-400'}>{isCspl ? 'CSPL Fast Bill API' : isPayout ? 'Instant Payout API' : 'Bill Payment (BBPS)'}</strong></span>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className={`border rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden transition-all ${
        isCspl
          ? 'bg-slate-800/90 border-blue-500/30'
          : isPayout 
            ? 'bg-slate-800/90 border-purple-500/30' 
            : 'bg-slate-800/90 border-slate-700'
      }`}>
        <div className={`absolute top-0 right-0 p-40 blur-[120px] rounded-full pointer-events-none ${
          isCspl ? 'bg-blue-600/15' : isPayout ? 'bg-purple-600/15' : 'bg-emerald-600/10'
        }`} />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
                <Activity className="h-3.5 w-3.5 text-indigo-400" /> API v1.0 Live
              </span>

              {isAdmin && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-400" /> Admin Mode
                </span>
              )}

              {isCspl ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-semibold">
                  <Zap className="h-3.5 w-3.5 text-blue-400" /> Service: CSPL Fast Bill API
                </span>
              ) : isPayout ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-semibold">
                  <Zap className="h-3.5 w-3.5 text-purple-400" /> Service: Instant Payout API
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Service: Utility Bill Payment (BBPS)
                </span>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-2">
              {pageTitle}
            </h1>
            <p className="text-slate-400 text-xs md:text-sm max-w-2xl leading-relaxed">
              {pageDescription}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 shrink-0 self-start md:self-center">
            <button
              data-html2canvas-ignore="true"
              onClick={handleExportPDF}
              disabled={exportingPdf}
              className={`inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl text-white font-bold text-xs md:text-sm shadow-xl border transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50 ${
                isCspl
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 border-blue-400/30'
                  : isPayout 
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 border-purple-400/30' 
                    : 'bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 border-indigo-400/30'
              }`}
            >
              {exportingPdf ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 text-white" />
                  <span>Export {isCspl ? 'CSPL' : isPayout ? 'Payout' : 'BBPS'} PDF Doc</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Section 1: Authentication & Base URL */}
      <section className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-slate-700/80 pb-3">
          <Key className="h-5 w-5 text-indigo-400" />
          1. Authentication & Mandatory HTTP Headers
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
            <span className="text-xs text-slate-400 font-mono font-semibold">Check Agent Wallet Balances</span>
          </div>

          <p className="text-xs text-slate-300">
            Retrieve real-time available wallet balance for your {isCspl ? 'dedicated CSPL Fast Bill Wallet' : isPayout ? 'dedicated Payout Wallet' : 'BBPS Utility Bill Payment Wallet'}.
          </p>

          <CodeBlock 
            title="Sample Response (200 OK)"
            section="balance_res"
            code={`{
  "status": "success",
  "data": {
    "balance": 25450.75,
    "bbps_wallet_balance": 15450.75,
    "payout_wallet_balance": 10000.00,
    "cspl_wallet_balance": 12500.00,
    "usable_bbps_balance": 15450.75,
    "fixed_deposit_amount": 0,
    "is_bbps_enabled": ${isBbpsEnabled},
    "is_payout_enabled": ${isPayoutEnabled},
    "is_cspl_enabled": ${isCsplEnabled}
  }
}`}
          />

          <ParamTable params={[
            { name: "status", type: "String", required: true, desc: "Status of request execution ('success' or 'error')." },
            { name: "data.balance", type: "Number", required: true, desc: "Legacy / default BBPS wallet balance (₹)." },
            { name: "data.bbps_wallet_balance", type: "Number", required: true, desc: "Dedicated wallet balance for utility bill payments (₹)." },
            { name: "data.payout_wallet_balance", type: "Number", required: true, desc: "Dedicated wallet balance for 24x7 instant bank payouts (₹)." },
            { name: "data.cspl_wallet_balance", type: "Number", required: true, desc: "Dedicated wallet balance for CSPL Fast BBPS bill payments (₹)." },
            { name: "data.is_bbps_enabled", type: "Boolean", required: true, desc: "Whether Bill Payment service is active for this agent." },
            { name: "data.is_payout_enabled", type: "Boolean", required: true, desc: "Whether Instant Payout API service is active for this agent." },
            { name: "data.is_cspl_enabled", type: "Boolean", required: true, desc: "Whether CSPL Fast Bill Payment API service is active for this agent." }
          ]} />
        </div>

        {/* ========================================================================= */}
        {/* CASE A: BILL PAYMENT (BBPS) ENDPOINTS ONLY                                */}
        {/* ========================================================================= */}
        {isBbps && (
          <>
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
                Execute the bill payment. Validates agent BBPS wallet balance, deducts funds, and processes payment via BBPS gateway.
              </p>

              <div className="relative z-10">
                <h4 className="font-semibold text-white text-xs mb-2">Request Payload Parameters:</h4>
                <ParamTable params={[
                  { name: "billerId", type: "String", required: true, desc: "Target Biller ID (e.g., 'DGVCL0000GUJ01', 'SBIC00000NATDN')." },
                  { name: "amount", type: "Number", required: true, desc: "Amount to be paid in Rupees (e.g. 1500.00). Pass full bill amount or custom partial amount." },
                  { name: "mobile", type: "String", required: true, desc: "10-digit customer mobile number." },
                  { name: "paymentMode", type: "String", required: false, desc: "Payment mode: 'Cash', 'UPI', 'Internet Banking', 'Debit Card', 'Credit Card'. Default: 'Cash'." },
                  { name: "client_transaction_id", type: "String", required: false, desc: "Your system's unique transaction/order ID for idempotency & tracing." },
                  { name: "customerParams", type: "Array of Objects", required: true, desc: "Array of { name, value } matching required biller parameters." },
                  { name: "customerPan", type: "String", required: false, desc: "Customer 10-digit PAN Card (MANDATORY for Cash payments >= ₹50,000)." },
                  { name: "billerResponseInfo", type: "Object", required: false, desc: "Pass exact billerResponse object returned by /fetch-bill." }
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
  }
}`}
              />

              {/* Lifecycle Notice */}
              <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-4 text-xs text-indigo-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-indigo-300">
                  <Sparkles className="h-4 w-4 text-indigo-400" />
                  <span>Transaction Lifecycle Guide (Success vs Pending vs Failed):</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-300 leading-relaxed pl-1">
                  <li>
                    <strong className="text-emerald-400">HTTP 200 (Success):</strong> Payment is immediately confirmed by biller. Mark as <code>SUCCESS</code> in your database.
                  </li>
                  <li>
                    <strong className="text-amber-400">HTTP 202 (Pending):</strong> Payment is accepted by biller and is processing. Mark as <code>PENDING</code> in your database. <strong>Do NOT mark as Success or Failed yet.</strong> Query <code>/status/:transaction_id</code> or wait for the automatic Webhook callback.
                  </li>
                  <li>
                    <strong className="text-rose-400">HTTP 400 (Failed):</strong> Payment rejected by biller or gateway. Wallet deduction is immediately auto-refunded (<code>refunded: true</code>). Mark as <code>FAILED</code> in your database.
                  </li>
                </ul>
              </div>

              <CodeBlock 
                title="1. Success Response (HTTP 200 OK - Payment Processed Successfully)"
                section="pay_res_success"
                code={`{
  "status": "success",
  "payment_status": "success",
  "message": "Bill Paid successfully",
  "data": {
    "transaction_id": "BBPSU1283118228",
    "api_txn_id": "BBPSU1283118228",
    "client_transaction_id": "TXN_ORD_20260814_001",
    "status": "success",
    "payment_status": "success"
  },
  "transaction_id": "BBPSU1283118228",
  "client_transaction_id": "TXN_ORD_20260814_001",
  "bbps_txn_ref_id": "CC016226CBAF13851712",
  "charge_deducted": 10.00,
  "refunded": false,
  "refunded_amount": 0
}`}
              />

              <CodeBlock 
                title="2. Pending Response (HTTP 202 Accepted - Awaiting Biller Confirmation)"
                section="pay_res_pending"
                code={`{
  "status": "pending",
  "payment_status": "pending",
  "message": "Transaction initiated, currently pending at biller",
  "data": {
    "transaction_id": "BBPSU1283118228",
    "api_txn_id": "BBPSU1283118228",
    "client_transaction_id": "TXN_ORD_20260814_001",
    "status": "pending",
    "payment_status": "pending"
  },
  "transaction_id": "BBPSU1283118228",
  "client_transaction_id": "TXN_ORD_20260814_001",
  "bbps_txn_ref_id": "BBPSU1283118228",
  "charge_deducted": 0,
  "refunded": false,
  "refunded_amount": 0
}`}
              />

              <CodeBlock 
                title="3. Failed & Auto-Refunded Response (HTTP 400 Bad Request - Biller Rejection)"
                section="pay_res_failed"
                code={`{
  "status": "failed",
  "payment_status": "failed",
  "message": "Payment failed at gateway / biller network",
  "transaction_id": "BBPSU1283118228",
  "client_transaction_id": "TXN_ORD_20260814_001",
  "refunded": true,
  "refunded_amount": 1500.00
}`}
              />

              <CodeBlock 
                title="4. Insufficient Balance Error (HTTP 400 Bad Request)"
                section="pay_res_insufficient"
                code={`{
  "status": "error",
  "message": "Insufficient BBPS Wallet Balance. Required: ₹1510.00, Current Balance: ₹450.00"
}`}
              />
            </div>

            {/* 2.6 GET /status/:transaction_id */}
            <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4 relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-3 relative z-10">
                <h3 className="text-lg font-bold text-white flex items-center gap-3">
                  <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider">GET</span>
                  /status/:transaction_id
                </h3>
                <span className="text-xs text-slate-400 font-mono font-semibold">Check Live Status & Auto-Refund</span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed relative z-10">
                Check real-time live transaction status. Query using any identifier: <code>BBPSU...</code>, <code>client_transaction_id</code>, <code>fetchRequestId</code>, or <code>CC01...</code>.
              </p>

              <CodeBlock 
                title="Pending Status Response (HTTP 202 / Processing at Biller)"
                section="status_res_pending"
                code={`{
  "status": "pending",
  "payment_status": "pending",
  "data": {
    "transaction_id": "BBPSU1283118228",
    "client_transaction_id": "TXN_ORD_20260814_001",
    "bbps_txn_ref_id": "BBPSU1283118228",
    "current_status": "pending",
    "status": "pending",
    "payment_status": "pending",
    "bbps_status": "PENDING",
    "polled_at": "2026-08-14T03:15:00.000Z"
  }
}`}
              />

              <CodeBlock 
                title="Success Status Response (HTTP 200 / Confirmed by Biller)"
                section="status_res_code"
                code={`{
  "status": "success",
  "payment_status": "success",
  "data": {
    "transaction_id": "BBPSU1283118228",
    "client_transaction_id": "TXN_ORD_20260814_001",
    "bbps_txn_ref_id": "CC016226CBAF13851712",
    "approval_ref_number": "1234567890",
    "current_status": "success",
    "status": "success",
    "payment_status": "success",
    "bbps_status": "SUCCESS",
    "polled_at": "2026-08-14T03:16:00.000Z"
  }
}`}
              />

              <CodeBlock 
                title="Failed & Auto-Refunded Status Response"
                section="status_res_auto_refund"
                code={`{
  "status": "failed",
  "payment_status": "failed",
  "data": {
    "transaction_id": "BBPSU1283118228",
    "client_transaction_id": "TXN_ORD_20260814_001",
    "bbps_txn_ref_id": "N/A",
    "current_status": "failed",
    "status": "failed",
    "payment_status": "failed",
    "bbps_status": "FAILED_GATEWAY_ERROR",
    "message": "Bill payment failed to connect to biller gateway. BBPS wallet automatically refunded.",
    "refund_status": "REFUNDED",
    "refunded_amount": 1500.00
  }
}`}
              />
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* CASE B: INSTANT PAYOUT ENDPOINTS ONLY                                      */}
        {/* ========================================================================= */}
        {isPayout && (
          <>
            {/* 2.2 POST /payout/transfer */}
            <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-3">
                  <span className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider">POST</span>
                  /payout/transfer
                </h3>
                <span className="text-xs text-purple-300 font-mono font-semibold">24x7 Instant Bank Transfer</span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Execute 24x7 real-time bank account transfer via IMPS or NEFT. Deducts <code>Amount + Total Fee (Base Slab Fee + 18% GST)</code> strictly from your dedicated <strong>Payout Wallet</strong>. If the upstream bank transfer fails, funds are automatically refunded to your Payout Wallet.
              </p>

              <ParamTable params={[
                { name: "amount", type: "Number", required: true, desc: "Transfer amount in INR (₹100 to ₹2,00,000)." },
                { name: "account_number", type: "String", required: true, desc: "Beneficiary bank account number (8 to 22 digits)." },
                { name: "ifsc_code", type: "String", required: true, desc: "Beneficiary bank IFSC Code (11 alphanumeric characters)." },
                { name: "beneficiary_name", type: "String", required: true, desc: "Name of the bank account holder." },
                { name: "mobile_number", type: "String", required: false, desc: "Beneficiary / customer 10-digit mobile number. If omitted, your agent account registered mobile is used automatically." },
                { name: "transfer_mode", type: "String", required: false, desc: "Transfer mode: 'IMPS' (default, 24x7 instant) or 'NEFT'." },
                { name: "client_order_id", type: "String", required: false, desc: "Your system's unique transaction/order ID for idempotency and status query." },
                { name: "bank_name", type: "String", required: false, desc: "Optional name of the beneficiary bank." },
                { name: "email", type: "String", required: false, desc: "Optional customer or sender email address." },
                { name: "webhook_url", type: "String", required: false, desc: "Optional callback URL (HTTP/HTTPS POST). If provided, instant status updates & bank UTRs will be dispatched to this endpoint and auto-configured." }
              ]} />

              <CodeBlock 
                title="Sample Request Body"
                section="payout_req_body"
                code={`{
  "amount": 2500.00,
  "account_number": "91234567890123",
  "ifsc_code": "HDFC0001234",
  "beneficiary_name": "Ramesh Kumar",
  "mobile_number": "9876543210",
  "transfer_mode": "IMPS",
  "client_order_id": "ORD_PAYOUT_1001",
  "bank_name": "HDFC Bank",
  "webhook_url": "https://api.partner.com/api/v1/payout/callback"
}`}
              />

              <CodeBlock 
                title="Sample Success Response (200 OK)"
                section="payout_res_success"
                code={`{
  "status": "success",
  "message": "Payout transfer completed successfully",
  "data": {
    "order_id": "B2BPO1727443912001",
    "client_order_id": "ORD_PAYOUT_1001",
    "utr": "426812831122",
    "amount": 2500.00,
    "base_fee": 25.00,
    "gst": 4.50,
    "fee": 29.50,
    "total_deducted": 2529.50,
    "beneficiary_name": "Ramesh Kumar",
    "account_number": "91234567890123",
    "ifsc_code": "HDFC0001234",
    "status": "success"
  }
}`}
              />

              <CodeBlock 
                title="Sample Failed & Refunded Response (400 Bad Request)"
                section="payout_res_failed"
                code={`{
  "status": "failed",
  "message": "Beneficiary account inactive or invalid IFSC. Funds refunded to payout wallet.",
  "data": {
    "order_id": "B2BPO1727443912001",
    "client_order_id": "ORD_PAYOUT_1001",
    "amount": 2500.00,
    "fee": 25.00,
    "refunded_to_payout_wallet": true,
    "status": "failed"
  }
}`}
              />
            </div>

            {/* 2.3 GET /payout/status/:order_id */}
            <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-3">
                  <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider">GET</span>
                  /payout/status/:order_id
                </h3>
                <span className="text-xs text-slate-400 font-mono font-semibold">Check Payout Status & Bank UTR</span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Query the real-time status of a payout transfer using either the system <code>order_id</code> or your own <code>client_order_id</code>.
              </p>

              <CodeBlock 
                title="Sample Response (200 OK)"
                section="payout_status_res"
                code={`{
  "status": "success",
  "data": {
    "order_id": "B2BPO1727443912001",
    "client_order_id": "ORD_PAYOUT_1001",
    "utr": "426812831122",
    "beneficiary_name": "Ramesh Kumar",
    "account_number": "91234567890123",
    "ifsc_code": "HDFC0001234",
    "transfer_mode": "IMPS",
    "amount": 2500.00,
    "fee": 25.00,
    "total_deducted": 2525.00,
    "status": "success",
    "created_at": "2026-09-27T08:15:00.000Z"
  }
}`}
              />
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* CASE C: CSPL FAST BILL PAYMENT ENDPOINTS ONLY                             */}
        {/* ========================================================================= */}
        {isCspl && (
          <>
            {/* 2.2 POST /cspl/biller-info */}
            <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-3">
                  <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider">POST</span>
                  /cspl/biller-info
                </h3>
                <span className="text-xs text-blue-300 font-mono font-semibold">CSPL Biller Info & Parameters</span>
              </div>

              <p className="text-xs text-slate-300">Fetch real-time biller details, customer input parameters, and validation metadata directly from CSPL gateway.</p>

              <CodeBlock 
                title="Sample Request Body"
                section="cspl_biller_req"
                code={`{
  "billerId": "DGVCL0000GUJ01"
}`}
              />

              <CodeBlock 
                title="Sample Response (200 OK)"
                section="cspl_biller_res"
                code={`{
  "status": "success",
  "data": {
    "responseCode": "000",
    "billerId": "DGVCL0000GUJ01",
    "billerName": "Dakshin Gujarat Vij Company Limited",
    "category": "Electricity",
    "fetchOption": "MANDATORY",
    "inputParams": [
      {
        "paramName": "Consumer Number",
        "dataType": "NUMERIC",
        "minLength": 11,
        "maxLength": 11,
        "isOptional": false
      }
    ]
  }
}`}
              />

              <ParamTable params={[
                { name: "billerId", type: "String", required: true, desc: "Unique Biller Identifier (e.g., DGVCL0000GUJ01, TORRENT000GUJ01)." }
              ]} />
            </div>

            {/* 2.3 POST /cspl/fetch-bill */}
            <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-3">
                  <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider">POST</span>
                  /cspl/fetch-bill
                </h3>
                <span className="text-xs text-blue-300 font-mono font-semibold">Instant JSON Bill Fetch</span>
              </div>

              <p className="text-xs text-slate-300">Fetch live outstanding bill details directly from CSPL gateway without XML latency. Returns due amount, bill date, due date, and customer name.</p>

              <CodeBlock 
                title="Sample Request Body"
                section="cspl_fetch_req"
                code={`{
  "billerId": "DGVCL0000GUJ01",
  "customerParams": {
    "Consumer Number": "12345678901"
  },
  "customerMobile": "9876543210"
}`}
              />

              <CodeBlock 
                title="Sample Response (200 OK)"
                section="cspl_fetch_res"
                code={`{
  "status": "success",
  "message": "Bill fetched successfully",
  "data": {
    "responseCode": "000",
    "customerName": "BHAVESHBHAI PATEL",
    "billAmount": 125000,
    "amount": "1250.00",
    "dueDate": "2026-10-15",
    "billDate": "2026-09-25",
    "billNumber": "DGV20260901",
    "billerResponse": {
      "customerName": "BHAVESHBHAI PATEL",
      "billAmount": "125000",
      "dueDate": "2026-10-15",
      "billDate": "2026-09-25"
    }
  }
}`}
              />

              <ParamTable params={[
                { name: "billerId", type: "String", required: true, desc: "Unique CSPL Biller ID." },
                { name: "customerParams", type: "Object | Array", required: true, desc: "Key-value object or array of input parameters required by the biller." },
                { name: "customerMobile", type: "String", required: false, desc: "10-digit mobile number of the customer." },
                { name: "customerEmail", type: "String", required: false, desc: "Optional email address of the customer." }
              ]} />
            </div>

            {/* 2.4 POST /cspl/pay-bill */}
            <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-3">
                  <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider">POST</span>
                  /cspl/pay-bill
                </h3>
                <span className="text-xs text-blue-300 font-mono font-semibold">Sub-Second Fast Bill Pay</span>
              </div>

              <p className="text-xs text-slate-300">
                Execute an instant bill payment. Deducts atomically from your <strong>CSPL Wallet Balance</strong>. If payment fails at the CSPL gateway, funds and service charges are <strong>automatically refunded to your CSPL Wallet instantly</strong>.
              </p>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300">
                <span className="font-bold text-white">💡 Pro-Tip for Fetch-Mandatory Billers (e.g. Credit Cards):</span> Call <code>/cspl/fetch-bill</code> first, then pass the fetched <code>billDetails</code> (or <code>billerResponse</code>) in your pay request. If omitted, our backend will automatically attempt to link your latest fetch or auto-fetch on the fly. Users can pay any custom manual amount they choose.
              </div>

              <CodeBlock 
                title="Sample Request Body"
                section="cspl_pay_req"
                code={`{
  "billerId": "SBIC00000NATDN",
  "amount": 2500.00,
  "customerParams": {
    "Last 4 digit of primary credit card number": "0730",
    "Mobile Number": "8140428671"
  },
  "customerMobile": "8140428671",
  "customerName": "JIGNESHBHAI VANANI",
  "client_transaction_id": "CLIENT_TXN_998811",
  "billDetails": {
    "billerResponse": { ... },
    "additionalInfo": [ ... ]
  }
}`}
              />

              <CodeBlock 
                title="1. Successful Payment Response (HTTP 200 OK)"
                section="cspl_pay_res_success"
                code={`{
  "status": "success",
  "message": "Bill paid successfully via CSPL Fast BBPS",
  "data": {
    "transaction_id": "CSPL_1727615000000_1234",
    "client_transaction_id": "CLIENT_TXN_998811",
    "amount": 2500.00,
    "charge_deducted": 5.00,
    "total_deducted": 2505.00,
    "cspl_reference": "CAM98234112",
    "status": "success",
    "gateway_response": {
      "responseCode": "000",
      "status": "SUCCESS",
      "rrn": "CAM98234112",
      "message": "Transaction Successful"
    }
  }
}`}
              />

              <CodeBlock 
                title="2. Failed & Auto-Refunded Response (HTTP 400 Bad Request)"
                section="cspl_pay_res_fail"
                code={`{
  "status": "error",
  "message": "Bill payment failed at CSPL gateway. Your CSPL wallet balance has been refunded.",
  "data": {
    "transaction_id": "CSPL_1727615000000_1234",
    "client_transaction_id": "CLIENT_TXN_998811",
    "status": "failed",
    "refunded": true,
    "gateway_response": {
      "responseCode": "001",
      "status": "FAILED",
      "message": "Biller system not reachable"
    }
  }
}`}
              />

              <ParamTable params={[
                { name: "billerId", type: "String", required: true, desc: "Unique CSPL Biller ID." },
                { name: "amount", type: "Number", required: true, desc: "Any custom bill payment amount in INR (₹) (e.g. 1.00, 500, 2500, etc. Supports manual / partial payments)." },
                { name: "customerParams", type: "Object | Array", required: true, desc: "Biller required parameters (e.g. Consumer Number or Card Last 4 Digits & Mobile)." },
                { name: "customerMobile", type: "String", required: false, desc: "Customer mobile number for SMS alert." },
                { name: "customerName", type: "String", required: false, desc: "Customer name." },
                { name: "client_transaction_id", type: "String", required: false, desc: "Unique transaction identifier generated by your own system for reconciliation." },
                { name: "billDetails", type: "Object", required: false, desc: "Bill details or billerResponse received from /cspl/fetch-bill (strongly recommended for fetch-mandatory billers like Credit Card)." }
              ]} />
            </div>

            {/* 2.5 GET /cspl/status/:transaction_id */}
            <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-3">
                  <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider">GET</span>
                  /cspl/status/:transaction_id
                </h3>
                <span className="text-xs text-blue-300 font-mono font-semibold">Check CSPL Payment Status</span>
              </div>

              <p className="text-xs text-slate-300">Query real-time transaction status using <code>transaction_id</code> or your <code>client_transaction_id</code>.</p>

              <CodeBlock 
                title="Sample Response (200 OK)"
                section="cspl_status_res"
                code={`{
  "status": "success",
  "data": {
    "transaction_id": "CSPL_1727615000000_1234",
    "client_transaction_id": "CLIENT_TXN_998811",
    "status": "success",
    "amount": 1250.00,
    "charge_deducted": 5.00,
    "total_deduction": 1255.00,
    "created_at": "2026-09-29T10:15:00.000Z"
  }
}`}
              />
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* FUND MANAGEMENT & BANK ACCOUNTS (TAILORED TO ACTIVE SERVICE)              */}
        {/* ========================================================================= */}
        <div className="space-y-8">
          <div className="flex items-center gap-2 pt-2">
            <span className={`h-2.5 w-2.5 rounded-full animate-pulse ${isCspl ? 'bg-blue-400' : isPayout ? 'bg-purple-400' : 'bg-emerald-400'}`} />
            <h3 className={`text-sm font-bold uppercase tracking-wider ${isCspl ? 'text-blue-400' : isPayout ? 'text-purple-400' : 'text-emerald-400'}`}>
              {isCspl ? 'CSPL Wallet Fund Deposit APIs' : isPayout ? 'Payout Wallet Fund Deposit APIs' : 'BBPS Wallet Fund Deposit APIs'}
            </h3>
          </div>

          {/* GET /admin-bank-accounts */}
          <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-3">
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider">GET</span>
                /admin-bank-accounts
              </h3>
              <span className="text-xs text-slate-400 font-mono font-semibold">Get Admin Bank Accounts List</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Retrieve active company bank accounts configured by B2B Admin for wallet fund top-up. Render these accounts in a dropdown list for the agent to select their deposit destination.
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

          {/* POST /fund-request */}
          <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-700/80 pb-3 gap-2">
              <h3 className="text-lg font-bold text-white flex items-center gap-3">
                <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider">POST</span>
                /fund-request
              </h3>
              <span className="text-xs text-slate-400 font-mono font-semibold">Submit B2B Fund Request</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Submit a wallet fund request electronically to top up your balance. Your request will be queued in <code className="text-amber-400 font-mono">pending</code> status for B2B Admin verification and approval.
            </p>

            {/* Crucial Multi-Service Wallet Type Guide Card */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950/40 border border-indigo-500/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse"></span>
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Target Wallet Selection Guide (<code className="text-indigo-300 lowercase font-mono">wallet_type</code>)
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Our platform manages separate, secure wallets for different services. In your API request, specify <code className="text-indigo-300 font-bold font-mono">wallet_type</code> to ensure funds are added to the desired service wallet:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                {/* CSPL Fast Bill Wallet Card */}
                <div 
                  onClick={() => setDocFundWallet('cspl')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    docFundWallet === 'cspl' 
                      ? 'bg-blue-950/60 border-blue-500 ring-2 ring-blue-500/30 shadow-lg' 
                      : 'bg-slate-900/60 border-slate-700/80 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                      CSPL Fast Bill
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30">
                      "cspl"
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-tight">
                    For Instant Sub-second Bill Payment API (<code className="text-blue-300">/cspl/pay-bill</code>).
                  </p>
                  <div className="mt-2.5 text-[11px] font-mono text-blue-400 font-semibold bg-blue-950/80 px-2 py-1 rounded border border-blue-500/20">
                    "wallet_type": "cspl"
                  </div>
                </div>

                {/* BBPS Utility Wallet Card */}
                <div 
                  onClick={() => setDocFundWallet('bbps')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    docFundWallet === 'bbps' 
                      ? 'bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/30 shadow-lg' 
                      : 'bg-slate-900/60 border-slate-700/80 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      BBPS Utility
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">
                      "bbps"
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-tight">
                    For Standard BillAvenue Utility Payments (<code className="text-emerald-300">/pay-bill</code>).
                  </p>
                  <div className="mt-2.5 text-[11px] font-mono text-emerald-400 font-semibold bg-emerald-950/80 px-2 py-1 rounded border border-emerald-500/20">
                    "wallet_type": "bbps"
                  </div>
                </div>

                {/* Payout Wallet Card */}
                <div 
                  onClick={() => setDocFundWallet('payout')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    docFundWallet === 'payout' 
                      ? 'bg-purple-950/60 border-purple-500 ring-2 ring-purple-500/30 shadow-lg' 
                      : 'bg-slate-900/60 border-slate-700/80 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                      Bank Payout
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30">
                      "payout"
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-tight">
                    For 24x7 IMPS / NEFT Instant Transfers (<code className="text-purple-300">/payout/transfer</code>).
                  </p>
                  <div className="mt-2.5 text-[11px] font-mono text-purple-400 font-semibold bg-purple-950/80 px-2 py-1 rounded border border-purple-500/20">
                    "wallet_type": "payout"
                  </div>
                </div>
              </div>

              {/* Warning note */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-[11px] text-amber-200/90 flex items-start gap-2.5 mt-2">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Important Notice:</strong> If you use both CSPL and BBPS services, please make sure your software passes <code className="text-white font-bold bg-slate-900 px-1.5 py-0.5 rounded font-mono">"wallet_type": "cspl"</code> when transferring money for CSPL. If you pass <code className="text-white font-bold bg-slate-900 px-1.5 py-0.5 rounded font-mono">"wallet_type": "bbps"</code> (or omit it), the deposit will be added to your <strong>BBPS Wallet</strong> instead.
                </div>
              </div>
            </div>

            {/* Request Body with active selection tab */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-200">
                  Sample Request Body: <span className="text-indigo-400">{docFundWallet === 'cspl' ? 'CSPL Fast Bill Wallet' : docFundWallet === 'payout' ? 'Payout Wallet' : 'BBPS Utility Wallet'}</span>
                </span>
                <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-700 w-fit">
                  <button
                    type="button"
                    onClick={() => setDocFundWallet('cspl')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                      docFundWallet === 'cspl' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    CSPL ("cspl")
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocFundWallet('bbps')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                      docFundWallet === 'bbps' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    BBPS ("bbps")
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocFundWallet('payout')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                      docFundWallet === 'payout' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Payout ("payout")
                  </button>
                </div>
              </div>

              <CodeBlock 
                title={`Sample Request Body - ${docFundWallet.toUpperCase()} Wallet Top-up`}
                section="fund_req_body"
                code={`{
  "amount": 50000,
  "utr_number": "UTR9876543210",
  "wallet_type": "${docFundWallet}", // "cspl" | "bbps" | "payout"
  "admin_bank_account_id": "a98e21bc-1234-4567-89ab-cdef01234567",
  "proof_url": "https://example.com/payment_receipt.jpg"
}`}
              />
            </div>

            <CodeBlock 
              title={`Sample Success Response (201 Created) - ${docFundWallet.toUpperCase()}`}
              section="fund_req_res"
              code={`{
  "status": "success",
  "message": "Fund request submitted successfully and pending approval",
  "data": {
    "request_id": "88a912bc-9430-4e2b-8a2b-103bc4a9192b",
    "amount": 50000,
    "utr_number": "UTR9876543210",
    "wallet_type": "${docFundWallet}",
    "status": "pending",
    "submitted_at": "2026-08-15T00:33:00.000Z"
  }
}`}
            />

            <ParamTable params={[
              { name: "amount", type: "Number", required: true, desc: "Amount in INR (₹) requested to credit to your account." },
              { name: "utr_number", type: "String", required: true, desc: "Unique Bank Transaction Reference / UTR Number." },
              { 
                name: "wallet_type", 
                type: "String", 
                required: true, 
                desc: "Target wallet destination. Allowed values: 'cspl' (CSPL Fast Bill Wallet), 'bbps' (Standard BBPS Utility Wallet), or 'payout' (Bank Payout Wallet). Crucial: Pass 'cspl' for CSPL, 'bbps' for BBPS, and 'payout' for Payout." 
              },
              { name: "admin_bank_account_id", type: "String", required: false, desc: "Optional ID of the Admin Bank Account where money was deposited (from GET /admin-bank-accounts)." },
              { name: "proof_url", type: "String", required: false, desc: "Optional URL linking to payment receipt or transaction screenshot." }
            ]} />
          </div>

          {/* GET /fund-request/status/:request_id */}
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
    "wallet_type": "${docFundWallet}",
    "status": "approved",
    "created_at": "2026-08-15T00:33:00.000Z"
  }
}`}
            />
          </div>
        </div>
      </section>

      {/* Section 3: Multi-Language Code Integration Examples (Dedicated to active service) */}
      <section className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4">
        <div className="border-b border-slate-700/80 pb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Code className="h-5 w-5 text-indigo-400" />
            3. Code Integration Examples: {isCspl ? 'CSPL Fast Bill Payment (/cspl/pay-bill)' : isPayout ? 'Instant Payout (/payout/transfer)' : 'Bill Payment (/pay-bill)'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Production-ready code templates in multiple languages for executing {isCspl ? 'sub-second CSPL bill payments' : isPayout ? '24x7 instant payouts' : 'instant bill payments'}.
          </p>
        </div>

        {/* Language Tabs */}
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

        {isCspl ? (
          <>
            {activeLang === 'curl' && (
              <CodeBlock 
                title="cURL Request Example (/cspl/pay-bill)"
                section="code_curl_cspl"
                code={`curl -X POST "${baseUrl}/api/v1/b2b/cspl/pay-bill" \\
  -H "x-api-key: pub_live_your_key_here" \\
  -H "x-secret-key: sec_live_your_secret_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "billerId": "DGVCL0000GUJ01",
    "amount": 1250.00,
    "customerParams": {
      "Consumer Number": "12345678901"
    },
    "customerMobile": "9876543210",
    "customerName": "BHAVESHBHAI PATEL",
    "client_transaction_id": "CLIENT_TXN_998811"
  }'`}
              />
            )}

            {activeLang === 'nodejs' && (
              <CodeBlock 
                title="Node.js Integration Example (Axios - CSPL Bill Pay)"
                section="code_nodejs_cspl"
                code={`const axios = require('axios');

async function payCsplBill() {
  try {
    const response = await axios.post('${baseUrl}/api/v1/b2b/cspl/pay-bill', {
      billerId: 'DGVCL0000GUJ01',
      amount: 1250.00,
      customerParams: {
        'Consumer Number': '12345678901'
      },
      customerMobile: '9876543210',
      customerName: 'BHAVESHBHAI PATEL',
      client_transaction_id: 'CLIENT_TXN_998811'
    }, {
      headers: {
        'x-api-key': 'pub_live_your_key_here',
        'x-secret-key': 'sec_live_your_secret_here',
        'Content-Type': 'application/json'
      }
    });

    console.log('Payment Status:', response.data.status);
    console.log('CSPL Ref:', response.data.data?.cspl_reference);
    console.log('Transaction ID:', response.data.data?.transaction_id);
  } catch (error) {
    console.error('Payment Error:', error.response?.data || error.message);
  }
}

payCsplBill();`}
              />
            )}

            {activeLang === 'python' && (
              <CodeBlock 
                title="Python Integration Example (Requests - CSPL Bill Pay)"
                section="code_python_cspl"
                code={`import requests

url = "${baseUrl}/api/v1/b2b/cspl/pay-bill"

headers = {
    "x-api-key": "pub_live_your_key_here",
    "x-secret-key": "sec_live_your_secret_here",
    "Content-Type": "application/json"
}

payload = {
    "billerId": "DGVCL0000GUJ01",
    "amount": 1250.00,
    "customerParams": {
        "Consumer Number": "12345678901"
    },
    "customerMobile": "9876543210",
    "customerName": "BHAVESHBHAI PATEL",
    "client_transaction_id": "CLIENT_TXN_998811"
}

response = requests.post(url, json=payload, headers=headers)
print("HTTP Status:", response.status_code)
print("Response JSON:", response.json())`}
              />
            )}

            {activeLang === 'php' && (
              <CodeBlock 
                title="PHP Integration Example (cURL - CSPL Bill Pay)"
                section="code_php_cspl"
                code={`<?php
$url = "${baseUrl}/api/v1/b2b/cspl/pay-bill";

$payload = json_encode([
    "billerId" => "DGVCL0000GUJ01",
    "amount" => 1250.00,
    "customerParams" => [
        "Consumer Number" => "12345678901"
    ],
    "customerMobile" => "9876543210",
    "customerName" => "BHAVESHBHAI PATEL",
    "client_transaction_id" => "CLIENT_TXN_998811"
]);

$ch = curl_init($url);
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
          </>
        ) : isPayout ? (
          <>
            {activeLang === 'curl' && (
              <CodeBlock 
                title="cURL Request Example (/payout/transfer)"
                section="code_curl_payout"
                code={`curl -X POST "${baseUrl}/api/v1/b2b/payout/transfer" \\
  -H "x-api-key: pub_live_your_key_here" \\
  -H "x-secret-key: sec_live_your_secret_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 2500.00,
    "account_number": "91234567890123",
    "ifsc_code": "HDFC0001234",
    "beneficiary_name": "Ramesh Kumar",
    "transfer_mode": "IMPS",
    "client_order_id": "ORD_PAYOUT_1001",
    "bank_name": "HDFC Bank"
  }'`}
              />
            )}

            {activeLang === 'nodejs' && (
              <CodeBlock 
                title="Node.js Integration Example (Axios - Instant Payout)"
                section="code_nodejs_payout"
                code={`const axios = require('axios');

async function sendPayout() {
  try {
    const response = await axios.post('${baseUrl}/api/v1/b2b/payout/transfer', {
      amount: 2500.00,
      account_number: '91234567890123',
      ifsc_code: 'HDFC0001234',
      beneficiary_name: 'Ramesh Kumar',
      transfer_mode: 'IMPS',
      client_order_id: 'ORD_PAYOUT_1001',
      bank_name: 'HDFC Bank'
    }, {
      headers: {
        'x-api-key': 'pub_live_your_key_here',
        'x-secret-key': 'sec_live_your_secret_here',
        'Content-Type': 'application/json'
      }
    });

    console.log('Payout Status:', response.data.status);
    console.log('Bank UTR:', response.data.data?.utr);
    console.log('Order ID:', response.data.data?.order_id);
  } catch (error) {
    console.error('Payout Error:', error.response?.data || error.message);
  }
}

sendPayout();`}
              />
            )}

            {activeLang === 'python' && (
              <CodeBlock 
                title="Python Integration Example (Requests - Instant Payout)"
                section="code_python_payout"
                code={`import requests

url = "${baseUrl}/api/v1/b2b/payout/transfer"
headers = {
    "x-api-key": "pub_live_your_key_here",
    "x-secret-key": "sec_live_your_secret_here",
    "Content-Type": "application/json"
}

payload = {
    "amount": 2500.00,
    "account_number": "91234567890123",
    "ifsc_code": "HDFC0001234",
    "beneficiary_name": "Ramesh Kumar",
    "transfer_mode": "IMPS",
    "client_order_id": "ORD_PAYOUT_1001",
    "bank_name": "HDFC Bank"
}

response = requests.post(url, json=payload, headers=headers)
print("Payout Result:", response.json())`}
              />
            )}

            {activeLang === 'php' && (
              <CodeBlock 
                title="PHP Integration Example (cURL - Instant Payout)"
                section="code_php_payout"
                code={`<?php
$ch = curl_init("${baseUrl}/api/v1/b2b/payout/transfer");

$payload = json_encode([
    "amount" => 2500.00,
    "account_number" => "91234567890123",
    "ifsc_code" => "HDFC0001234",
    "beneficiary_name" => "Ramesh Kumar",
    "transfer_mode" => "IMPS",
    "client_order_id" => "ORD_PAYOUT_1001",
    "bank_name" => "HDFC Bank"
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
          </>
        ) : (
          <>
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
                title="Node.js Integration Example (Axios - Bill Payment)"
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
                title="Python Integration Example (Requests - Bill Payment)"
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
print("Payment Result:", response.json())`}
              />
            )}

            {activeLang === 'php' && (
              <CodeBlock 
                title="PHP Integration Example (cURL - Bill Payment)"
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
          </>
        )}
      </section>

      {/* Section 4: Webhooks Section */}
      <section className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-slate-700/80 pb-3">
          <Activity className="h-5 w-5 text-indigo-400" />
          4. Webhook Notifications: {isCspl ? 'CSPL Fast Bill Payment Updates' : isPayout ? 'Instant Payout Status Updates' : 'BBPS Payment Updates'}
        </h2>

        <p className="text-xs text-slate-300">
          When transactions are initiated, our gateway engine verifies real-time status with {isCspl ? 'CSPL Camlenio BBPS' : isPayout ? 'the banking network' : 'BBPS'}. Once confirmed as <strong>Success</strong> or <strong>Failed</strong>, an HTTP POST callback is dispatched to your configured Webhook URL.
        </p>

        {isCspl ? (
          <div className="space-y-3 pt-2">
            <CodeBlock 
              title="CSPL Webhook Payload (Bill Payment Success)"
              section="webhook_cspl_success"
              code={`{
  "event": "CSPL_BILL_PAYMENT_SUCCESS",
  "transaction_id": "CSPL_1727615000000_1234",
  "client_transaction_id": "CLIENT_TXN_998811",
  "amount": 1250.00,
  "status": "success",
  "response": {
    "responseCode": "000",
    "status": "SUCCESS",
    "rrn": "CAM98234112",
    "message": "Transaction Successful"
  },
  "timestamp": "2026-09-29T10:15:02.000Z"
}`}
            />
          </div>
        ) : isPayout ? (
          <div className="space-y-3 pt-2">
            <CodeBlock 
              title="Payout Webhook Payload (Transfer Success)"
              section="webhook_payout_success"
              code={`{
  "event": "PAYOUT_STATUS_UPDATE",
  "order_id": "B2BPO1727443912001",
  "client_order_id": "ORD_PAYOUT_1001",
  "utr": "426812831122",
  "status": "success",
  "amount": 2500.00,
  "base_fee": 25.00,
  "gst": 4.50,
  "fee": 29.50,
  "total_deducted": 2529.50,
  "beneficiary_name": "Ramesh Kumar",
  "account_number": "91234567890123",
  "ifsc_code": "HDFC0001234",
  "timestamp": "2026-09-28T14:15:02.000Z"
}`}
            />

            <CodeBlock 
              title="Payout Webhook Payload (Transfer Failed & Auto-Refunded)"
              section="webhook_payout_failed"
              code={`{
  "event": "PAYOUT_STATUS_UPDATE",
  "order_id": "B2BPO1727443912001",
  "client_order_id": "ORD_PAYOUT_1001",
  "utr": null,
  "status": "failed",
  "amount": 2500.00,
  "base_fee": 25.00,
  "gst": 4.50,
  "fee": 29.50,
  "total_deducted": 2529.50,
  "beneficiary_name": "Ramesh Kumar",
  "account_number": "91234567890123",
  "ifsc_code": "HDFC0001234",
  "failure_reason": "Beneficiary account inactive or invalid IFSC. Funds refunded to payout wallet.",
  "timestamp": "2026-09-28T14:15:02.000Z"
}`}
            />
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <CodeBlock 
              title="BBPS Webhook Payload Example (Transaction Success)"
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
              title="BBPS Webhook Payload Example (Transaction Failed & Instant Refunded)"
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
          </div>
        )}

        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-xs text-emerald-200 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <strong className="block mb-1 text-emerald-300">Automated Wallet Refund Guarantee:</strong>
            If any transaction is marked as <code>FAILED</code> by the upstream banking network or biller gateway, the system automatically refunds 100% of the principal amount and applicable charges back to your {isCspl ? 'CSPL Wallet' : isPayout ? 'Payout Wallet' : 'BBPS Wallet'} instantly.
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
                <td className="px-4 py-3 font-mono font-bold text-amber-400">202 Accepted</td>
                <td className="px-4 py-3 font-mono text-amber-300">pending</td>
                <td className="px-4 py-3 text-slate-300">
                  Transaction initiated & currently pending at biller / upstream banking gateway.
                </td>
                <td className="px-4 py-3 text-slate-300">
                  Store order as <code>PENDING</code>. Query <code>/status/:transaction_id</code> or wait for webhook. Do NOT mark failed.
                </td>
              </tr>
              <tr className="hover:bg-slate-800/40">
                <td className="px-4 py-3 font-mono font-bold text-rose-400">400 Bad Request</td>
                <td className="px-4 py-3 font-mono text-rose-300">error</td>
                <td className="px-4 py-3 text-slate-300">
                  Insufficient {isCspl ? 'CSPL' : isPayout ? 'Payout' : 'BBPS'} Wallet Balance to cover requested transaction.
                </td>
                <td className="px-4 py-3 text-slate-300">
                  Submit <code>/fund-request</code> with <code>wallet_type: "{isCspl ? 'cspl' : isPayout ? 'payout' : 'bbps'}"</code>.
                </td>
              </tr>
              {isPayout ? (
                <tr className="hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-mono font-bold text-rose-400">400 Bad Request</td>
                  <td className="px-4 py-3 font-mono text-rose-300">failed</td>
                  <td className="px-4 py-3 text-slate-300">Invalid IFSC code or beneficiary bank account inactive.</td>
                  <td className="px-4 py-3 text-slate-300">Check bank account and IFSC details. Auto-refunded.</td>
                </tr>
              ) : (
                <>
                  <tr className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono font-bold text-rose-400">400 Bad Request</td>
                    <td className="px-4 py-3 font-mono text-rose-300">failed</td>
                    <td className="px-4 py-3 text-slate-300">Bill payment rejected or failed by biller network.</td>
                    <td className="px-4 py-3 text-slate-300">Wallet balance is auto-refunded (<code>refunded: true</code>). Do not deliver bill receipt.</td>
                  </tr>
                  <tr className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono font-bold text-rose-400">400 Bad Request</td>
                    <td className="px-4 py-3 font-mono text-rose-300">error</td>
                    <td className="px-4 py-3 text-slate-300">Payment mode 'Cash' disabled by biller.</td>
                    <td className="px-4 py-3 text-slate-300">Pass <code>paymentMode: "UPI"</code> or <code>"Internet Banking"</code>.</td>
                  </tr>
                </>
              )}
              <tr className="hover:bg-slate-800/40">
                <td className="px-4 py-3 font-mono font-bold text-amber-400">401 Unauthorized</td>
                <td className="px-4 py-3 font-mono text-amber-300">error</td>
                <td className="px-4 py-3 text-slate-300">Invalid API/Secret Keys or IP address not whitelisted.</td>
                <td className="px-4 py-3 text-slate-300">Verify credentials and whitelist server IP in B2B settings.</td>
              </tr>
              <tr className="hover:bg-slate-800/40">
                <td className="px-4 py-3 font-mono font-bold text-amber-400">429 Rate Limit</td>
                <td className="px-4 py-3 font-mono text-amber-300">error</td>
                <td className="px-4 py-3 text-slate-300">Daily sync limit reached for directory endpoints.</td>
                <td className="px-4 py-3 text-slate-300">Cache directory data locally and query as needed.</td>
              </tr>
              <tr className="hover:bg-slate-800/40">
                <td className="px-4 py-3 font-mono font-bold text-rose-400">500 Server Error</td>
                <td className="px-4 py-3 font-mono text-rose-300">error</td>
                <td className="px-4 py-3 text-slate-300">Upstream Biller or Bank Gateway Timeout / System Down.</td>
                <td className="px-4 py-3 text-slate-300">Wallet is auto-refunded. Retry after a few minutes.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
