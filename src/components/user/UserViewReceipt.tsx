import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Printer,
  ShieldCheck,
  ArrowLeft,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format, parseISO } from 'date-fns';
import { LogoLoader } from '../shared/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { playMogoSound } from '../../lib/audio';

const getUtrOrTxnId = (item: any): string => {
  if (!item) return 'N/A';
  if (item.transaction_id && item.transaction_id !== 'N/A') return item.transaction_id;
  if (item.rejection_reason && item.rejection_reason !== 'N/A') return item.rejection_reason;
  if (item.metadata?.txnid) return item.metadata.txnid;
  if (item.metadata?.rrn) return item.metadata.rrn;
  if (item.metadata?.reference) return item.metadata.reference;
  if (item.metadata?.utr) return item.metadata.utr;
  if (item.metadata?.billerResponse?.txnid) return item.metadata.billerResponse.txnid;
  if (item.metadata?.rawFetchData?.txnid) return item.metadata.rawFetchData.txnid;
  return 'N/A';
};

interface UserViewReceiptProps {
  userId: string;
}

export default function UserViewReceipt({ userId }: UserViewReceiptProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const txnId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<any | null>(null);
  const [billAvenueReceipt, setBillAvenueReceipt] = useState<any | null>(null);

  const fetchReceiptDetails = async () => {
    if (!txnId) {
      toast.error('Invalid Transaction ID');
      navigate('/user/bill-history');
      return;
    }

    setLoading(true);
    try {
      // 1. Fetch submission details from bbps_submissions
      const { data: subData, error: subError } = await supabase
        .from('bbps_submissions')
        .select('*')
        .eq('user_id', userId)
        .eq('transaction_id', txnId)
        .maybeSingle();

      if (subError) throw subError;

      if (!subData) {
        toast.error('Transaction not found');
        navigate('/user/bill-history');
        return;
      }

      setSubmission(subData);

      if (subData.service_type === 'BillAvenue BBPS') {
        // 2. Fetch specific BillAvenue details
        let billerName = subData.provider;
        if (subData.provider === 'OTME00005XXZ43') {
          billerName = 'UAT Fetch & Pay (OTME00005XXZ43)';
        } else if (subData.provider === 'OTNS00005XXZ43') {
          billerName = 'UAT Quick Pay (OTNS00005XXZ43)';
        } else {
          const { data: dbBiller } = await supabase
            .from('billavenue_billers')
            .select('biller_name')
            .eq('biller_id', subData.provider)
            .maybeSingle();
          if (dbBiller?.biller_name) {
            billerName = dbBiller.biller_name;
          }
        }

        let ccf1Fee = 0;
        let customerName = 'Sumit C Patel';

        const { data: txnData } = await supabase
          .from('billavenue_transactions')
          .select('*')
          .eq('txn_ref_id', subData.transaction_id)
          .maybeSingle();

        if (txnData) {
          const payRes = txnData.response?.billPayResponse || {};
          if (payRes.CustConvFee) {
            ccf1Fee = Number(payRes.CustConvFee) / 100;
          }
        }

        if (subData.provider === 'OTME00005XXZ43' || subData.provider === 'OTNS00005XXZ43') {
          customerName = 'UAT QuickPay Customer';
        }

        // Deterministic approval number
        let hash = 0;
        const rawTxnId = subData.transaction_id || '';
        for (let i = 0; i < rawTxnId.length; i++) {
          hash = rawTxnId.charCodeAt(i) + ((hash << 5) - hash);
        }
        const code = Math.abs(hash % 900000) + 100000;
        const approvalNumber = `AP${code}`;

        setBillAvenueReceipt({
          bConnectTxnId: subData.transaction_id,
          billerId: subData.provider,
          billerName: billerName,
          customerName: customerName,
          customerNumber: subData.consumer_number,
          billDate: 'N/A',
          billPeriod: 'N/A',
          billNumber: 'N/A',
          dueDate: 'N/A',
          billAmount: Number(subData.amount),
          ccf1Fee: ccf1Fee,
          totalAmount: Number(subData.amount) + ccf1Fee,
          date: subData.metadata?.date || format(parseISO(subData.created_at), 'dd/MM/yyyy, hh:mm a'),
          initiatingChannel: 'Internet (WEB)',
          paymentMode: subData.metadata?.paymentMode || 'UPI',
          transactionStatus: 'Successful',
          approvalNumber: approvalNumber,
          consumerDetails: subData.metadata?.customerParams || {}
        });
        playMogoSound(subData.amount);
      }
    } catch (err: any) {
      toast.error('Error fetching receipt: ' + err.message);
      navigate('/user/bill-history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId && txnId) {
      fetchReceiptDetails();
    }
  }, [userId, txnId]);

  const handlePrint = () => {
    window.print();
  };

  const downloadPDFReceipt = async (receipt: any) => {
    if (!receipt) return;
    try {
      const module = await import('jspdf');
      const JsPDFClass = module.jsPDF || module.default;
      const autoTableModule = await import('jspdf-autotable');
      const autoTable: any = autoTableModule.default || (autoTableModule as any).autoTable || autoTableModule;
      const doc = new JsPDFClass({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const primaryColor: [number, number, number] = [15, 23, 42]; // slate-900

      // Header Banner (Black strip removed, background remains white)
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('UsePay', 20, 20);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text('Bharat Connect Utility Payment Receipt', 20, 30);

      // Add Be-Assured Logo image in the top-right corner
      const logoImg = document.getElementById('pdf-assured-logo') as HTMLImageElement;
      if (logoImg) {
        try {
          doc.addImage(logoImg, 'PNG', 160, 8, 30, 30);
        } catch (imgErr) {
          console.error('Error adding logo to PDF:', imgErr);
        }
      }

      // Receipt Box Title
      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('TRANSACTION RECEIPT', 20, 55);

      const columns = ['Parameter', 'Value'];
      const rows = [
        ['B-Connect Transaction ID', receipt.bConnectTxnId || 'N/A'],
        ['Biller ID', receipt.billerId || 'N/A'],
        ['Biller Name', receipt.billerName || 'N/A'],
        ['Customer Name', receipt.customerName || 'N/A'],
        ['Customer Number', receipt.customerNumber || 'N/A'],
        ['Bill Date', receipt.billDate || 'N/A'],
        ['Bill Period', receipt.billPeriod || 'N/A'],
        ['Bill Number', receipt.billNumber || 'N/A'],
        ['Due Date', receipt.dueDate || 'N/A'],
        ['Bill Amount', `INR ${Number(receipt.billAmount).toFixed(2)}`],
        ['Total Amount', `INR ${Number(receipt.totalAmount).toFixed(2)}`],
        ['Transaction Date and Time', receipt.date || 'N/A'],
        ['Initiating Channel', receipt.initiatingChannel || 'N/A'],
        ['Transaction Status', receipt.transactionStatus || 'N/A'],
        ['Approval Number', receipt.approvalNumber || 'N/A']
      ];

      autoTable(doc, {
        startY: 62,
        head: [columns],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: primaryColor },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 9, cellPadding: 3 }
      });

      // Footer
      const finalY = (doc as any).lastAutoTable.finalY || 150;
      doc.setDrawColor(226, 232, 240);
      doc.line(20, finalY + 10, 190, finalY + 10);

      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('This is a system-generated transaction receipt from UsePay secure gateway under Bharat Connect guidelines.', 20, finalY + 18);
      doc.text('For support, contact agentsupport@billavenue.com or open a dispute on UsePay portal.', 20, finalY + 23);

      doc.save(`Receipt_${receipt.bConnectTxnId}.pdf`);
      toast.success('Receipt PDF downloaded successfully.');
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Failed to generate PDF.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-3">
        <LogoLoader size="md" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Loading transaction receipt...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4">
      {/* Print styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          #print-receipt-container, #print-receipt-container * {
            visibility: visible !important;
          }
          #print-receipt-container {
            position: absolute !important;
            left: 50% !important;
            top: 20px !important;
            transform: translateX(-50%) !important;
            width: 100% !important;
            max-width: 500px !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}} />

      {/* Back to history link */}
      <div className="flex items-center justify-between print:hidden">
        <button
          onClick={() => navigate('/user/bill-history')}
          className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800 rounded-2xl text-xs font-black uppercase tracking-wider border border-slate-200/60 transition-all cursor-pointer shadow-sm animate-in fade-in duration-300"
        >
          <ArrowLeft size={14} />
          Back to Bill History
        </button>
      </div>

      <div className="flex justify-center w-full">
        {submission?.service_type === 'BillAvenue BBPS' && billAvenueReceipt ? (
          /* BillAvenue / Bharat Connect custom receipt card */
          <div
            className="w-full max-w-lg bg-white border border-slate-200 rounded-[36px] p-8 shadow-xl space-y-6 print:border-0 print:shadow-none animate-in zoom-in-95 duration-200"
            id="print-receipt-container"
          >
            <div className="w-full relative">
              <div className="absolute top-0 right-0 z-10">
                <img id="pdf-assured-logo" src="/assured_logo.png" alt="Be-Assured Logo" style={{ width: '80px', height: '80px', objectFit: 'contain' }} className="opacity-100 brightness-110 filter drop-shadow-sm" />
              </div>

              <div className="text-center border-b border-dashed border-slate-100 pb-5">
                <div className="flex flex-col items-center justify-center gap-2">
                  <CheckCircle2 className="text-emerald-500" size={40} />
                  <span className="text-[10px] bg-slate-900 text-white px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">Receipt</span>
                </div>
                <div className="text-2xl font-black text-slate-800 mt-4">
                  ₹{billAvenueReceipt.totalAmount.toFixed(2)}
                </div>
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">Transaction Success</p>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3.5 text-xs font-semibold text-slate-600 mt-6 text-left">
                <div className="flex flex-col border-b border-slate-100 pb-1.5 col-span-2">
                  <span className="text-slate-400 uppercase tracking-wider text-[9px]">B-Connect Transaction ID</span>
                  <span className="font-black text-slate-800 text-left font-mono mt-0.5 select-all">{billAvenueReceipt.bConnectTxnId}</span>
                </div>
                <div className="flex flex-col border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400 uppercase tracking-wider text-[9px]">Biller ID</span>
                  <span className="font-black text-slate-800 text-left mt-0.5">{billAvenueReceipt.billerId}</span>
                </div>
                <div className="flex flex-col border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400 uppercase tracking-wider text-[9px]">Biller Name</span>
                  <span className="font-black text-slate-800 text-left mt-0.5 truncate" title={billAvenueReceipt.billerName}>{billAvenueReceipt.billerName}</span>
                </div>
                <div className="flex flex-col border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400 uppercase tracking-wider text-[9px]">Customer Name</span>
                  <span className="font-black text-slate-800 text-left mt-0.5">{billAvenueReceipt.customerName}</span>
                </div>
                <div className="flex flex-col border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400 uppercase tracking-wider text-[9px]">Customer Number</span>
                  <span className="font-black text-slate-800 text-left mt-0.5">{billAvenueReceipt.customerNumber}</span>
                </div>
                <div className="flex flex-col border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400 uppercase tracking-wider text-[9px]">Bill Date</span>
                  <span className="font-black text-slate-800 text-left mt-0.5">{billAvenueReceipt.billDate}</span>
                </div>
                <div className="flex flex-col border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400 uppercase tracking-wider text-[9px]">Bill Period</span>
                  <span className="font-black text-slate-800 text-left mt-0.5">{billAvenueReceipt.billPeriod}</span>
                </div>
                <div className="flex flex-col border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400 uppercase tracking-wider text-[9px]">Bill Number</span>
                  <span className="font-black text-slate-800 text-left mt-0.5">{billAvenueReceipt.billNumber}</span>
                </div>
                <div className="flex flex-col border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400 uppercase tracking-wider text-[9px]">Due Date</span>
                  <span className="font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded w-fit text-left mt-0.5">{billAvenueReceipt.dueDate}</span>
                </div>
                <div className="flex flex-col border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400 uppercase tracking-wider text-[9px]">Bill Amount</span>
                  <span className="font-black text-slate-800 text-left mt-0.5">₹{billAvenueReceipt.billAmount.toFixed(2)}</span>
                </div>
                <div className="flex flex-col border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400 uppercase tracking-wider text-[9px]">Customer Convenience Fees</span>
                  <span className="font-black text-slate-800 text-left mt-0.5">₹{billAvenueReceipt.ccf1Fee.toFixed(2)}</span>
                </div>
                <div className="flex flex-col border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400 uppercase tracking-wider text-[9px]">Total Amount</span>
                  <span className="font-black text-emerald-600 text-left text-sm mt-0.5">₹{billAvenueReceipt.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex flex-col border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400 uppercase tracking-wider text-[9px]">Transaction Date and Time</span>
                  <span className="font-black text-slate-800 text-left mt-0.5">{billAvenueReceipt.date}</span>
                </div>
                <div className="flex flex-col border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400 uppercase tracking-wider text-[9px]">Initiating Channel</span>
                  <span className="font-black text-slate-800 text-left mt-0.5">{billAvenueReceipt.initiatingChannel}</span>
                </div>
                <div className="flex flex-col border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400 uppercase tracking-wider text-[9px]">Payment Mode</span>
                  <span className="font-black text-slate-800 text-left mt-0.5">{billAvenueReceipt.paymentMode}</span>
                </div>
                <div className="flex flex-col border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400 uppercase tracking-wider text-[9px]">Transaction Status</span>
                  <span className="font-black text-emerald-600 text-left mt-0.5">{billAvenueReceipt.transactionStatus}</span>
                </div>
                <div className="flex flex-col border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400 uppercase tracking-wider text-[9px]">Approval Number</span>
                  <span className="font-black text-slate-800 text-left mt-0.5">{billAvenueReceipt.approvalNumber}</span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5 flex items-center justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">
                <div className="flex items-center gap-1">
                  <ShieldCheck size={11} className="text-emerald-500" />
                  Bharat Connect Secured
                </div>
                <span>UAT STAGING</span>
              </div>
            </div>

            <div className="mt-8 flex gap-4 w-full print:hidden">
              <button
                onClick={() => downloadPDFReceipt(billAvenueReceipt)}
                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-200/50"
              >
                Download Receipt
              </button>
              <button
                onClick={handlePrint}
                className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-100"
              >
                Print Receipt
              </button>
            </div>
          </div>
        ) : (
          /* Standard BBPS receipt card layout */
          submission && (
            <div
              className="w-full max-w-md bg-white border border-slate-200 rounded-[36px] p-8 shadow-xl space-y-6 print:border-0 print:shadow-none animate-in zoom-in-95 duration-200"
              id="print-receipt-container"
            >
              {/* E-receipt layout header */}
              <div className="text-center border-b border-dashed border-slate-200 pb-6">
                <div className="flex flex-col items-center justify-center gap-3">
                  <img src="/logo_receipt.png" alt="UsePay" className="h-10 w-auto object-contain" />
                  <span className="text-[10px] bg-slate-900 text-white px-3 py-1 rounded-full font-black uppercase tracking-[0.2em]">BBPS E-Receipt</span>
                </div>
                <div className="text-3xl font-black text-slate-800 mt-4">
                  ₹{Number(submission.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs font-black text-emerald-600 uppercase tracking-widest mt-1">Transaction Success</p>
              </div>

              {/* Slate Receipt detail rows */}
              <div className="space-y-4 text-xs font-medium text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Operator</span>
                  <span className="font-black text-slate-800 text-right">
                    {submission.metadata?.billerName || submission.provider}
                  </span>
                </div>

                {submission.metadata?.consumerDetails ? (
                  Object.entries(submission.metadata.consumerDetails).map(([key, val]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-slate-400 font-bold uppercase tracking-wider">{key}</span>
                      <span className="font-black text-slate-800 text-right">{String(val)}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold uppercase tracking-wider">Consumer ID</span>
                    <span className="font-black text-slate-800 text-right">{submission.consumer_number}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">B-Connect Transaction ID</span>
                  <span className="font-black text-slate-800 font-mono text-[11px] bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                    {getUtrOrTxnId(submission)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Date & Time</span>
                  <span className="font-black text-slate-800 text-right">
                    {submission.metadata?.date || format(parseISO(submission.created_at), 'dd/MM/yyyy, hh:mm a')}
                  </span>
                </div>
              </div>

              {/* Secure footer mark */}
              <div className="border-t border-slate-100 pt-6 flex items-center justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">
                <div className="flex items-center gap-1">
                  <ShieldCheck size={12} className="text-emerald-500" />
                  Secure BBPS Gateway
                </div>
                <span>Reference ID: {getUtrOrTxnId(submission).substring(0, 8)}</span>
              </div>

              {/* Print CTA */}
              <div className="pt-2 print:hidden">
                <button
                  onClick={handlePrint}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                  <Printer size={16} />
                  Print Receipt
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
