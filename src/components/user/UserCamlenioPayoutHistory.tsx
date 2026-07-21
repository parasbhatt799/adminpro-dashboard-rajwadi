import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, Printer, Search, FileText, CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface UserCamlenioPayoutHistoryProps {
  userId: string;
}

interface ReceiptData {
  reference: string;
  amount: number;
  charge: number;
  status: string;
  accountNumber: string;
  holderName: string;
  bankName: string;
  isError?: boolean;
  errorMessage?: string;
  date?: string;
}

export default function UserCamlenioPayoutHistory({ userId }: UserCamlenioPayoutHistoryProps) {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  useEffect(() => {
    fetchTransactions();
  }, [userId]);

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('payout_submissions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = (txn: any) => {
    setReceiptData({
      reference: txn.bank_ref || txn.utr_number || txn.id,
      amount: parseFloat(txn.amount) || 0,
      charge: parseFloat(txn.charge_amount) || 0,
      status: txn.status,
      accountNumber: txn.account_number,
      holderName: txn.account_holder_name,
      bankName: txn.bank_name,
      isError: txn.status === 'rejected',
      errorMessage: txn.remark,
      date: new Date(txn.created_at).toLocaleString()
    });
  };

  const filteredTxns = transactions.filter(t => 
    (t.account_holder_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (t.account_number?.includes(searchTerm)) ||
    (t.bank_ref?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payout History</h1>
          <p className="text-slate-500">View your recent AEPS payout transactions and receipts</p>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search name, A/C or Ref..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none w-full sm:w-64"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-700">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Reference</th>
                <th className="px-6 py-4">Beneficiary</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTxns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="font-medium text-slate-700">No transactions found</p>
                    <p className="text-sm mt-1">You haven't made any payouts yet.</p>
                  </td>
                </tr>
              ) : (
                filteredTxns.map((txn) => (
                  <tr key={txn.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-600">
                      {new Date(txn.created_at).toLocaleDateString()}<br/>
                      <span className="text-xs text-slate-400">{new Date(txn.created_at).toLocaleTimeString()}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {txn.bank_ref || txn.utr_number || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-900">{txn.account_holder_name}</div>
                      <div className="text-xs text-slate-500">{txn.bank_name} • {txn.account_number}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-900">₹{parseFloat(txn.amount).toFixed(2)}</div>
                      <div className="text-xs text-slate-500">Charge: ₹{parseFloat(txn.charge_amount).toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                        txn.status === 'approved' ? 'bg-green-100 text-green-700' :
                        txn.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {txn.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => handlePrint(txn)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-flex items-center justify-center"
                        title="View Receipt"
                      >
                        <Printer className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt Modal */}
      <AnimatePresence>
        {receiptData && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm print:hidden"
            />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col border-2 border-slate-100 print:shadow-none print:border-none print:w-full print:max-w-full"
            >
              {/* Header */}
              <div className={`p-4 flex justify-between items-center ${receiptData.isError ? 'bg-red-600' : 'bg-green-600'} text-white print:bg-transparent print:text-black print:border-b print:border-black`}>
                <h3 className="text-lg font-bold w-full text-center tracking-wide print:text-left print:text-2xl">
                  {receiptData.isError ? 'Payout Failed' : 'Payout Completed'}
                </h3>
                <button onClick={() => setReceiptData(null)} className="absolute right-4 text-white/80 hover:text-white transition-colors print:hidden">
                  <X size={24} />
                </button>
              </div>

              {/* Status Icon */}
              <div className="flex justify-center pt-8 pb-4 relative print:hidden">
                <div className="absolute inset-x-0 bottom-0 border-b border-slate-200"></div>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center relative z-10 ${receiptData.isError ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]'} text-white`}>
                  {receiptData.isError ? <X size={40} strokeWidth={3} /> : <CheckCircle2 size={40} strokeWidth={3} />}
                </div>
              </div>

              {/* Receipt Details */}
              <div className="px-6 py-6 space-y-3 bg-white text-sm">
                {receiptData.date && (
                  <div className="flex justify-between items-start gap-4">
                    <span className="text-blue-500 font-bold whitespace-nowrap">Date:</span>
                    <span className="text-slate-700 text-right font-medium">{receiptData.date}</span>
                  </div>
                )}
                <div className="flex justify-between items-start gap-4">
                  <span className="text-blue-500 font-bold whitespace-nowrap">Reference Id:</span>
                  <span className="text-slate-700 text-right font-medium break-all">{receiptData.reference}</span>
                </div>
                <div className="flex justify-between items-start gap-4">
                  <span className="text-blue-500 font-bold whitespace-nowrap">Amount:</span>
                  <span className="text-slate-700 text-right font-medium">₹{receiptData.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-start gap-4">
                  <span className="text-blue-500 font-bold whitespace-nowrap">Charges:</span>
                  <span className="text-slate-700 text-right font-medium">₹{receiptData.charge.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-start gap-4">
                  <span className="text-blue-500 font-bold whitespace-nowrap">Status:</span>
                  <span className={`text-right font-bold uppercase ${receiptData.status === 'approved' ? 'text-green-600' : receiptData.status === 'processing' ? 'text-amber-500' : 'text-red-600'}`}>
                    {receiptData.status}
                  </span>
                </div>
                <div className="flex justify-between items-start gap-4">
                  <span className="text-blue-500 font-bold whitespace-nowrap">Mode:</span>
                  <span className="text-slate-700 text-right font-medium">IMPS</span>
                </div>
                <div className="flex justify-between items-start gap-4">
                  <span className="text-blue-500 font-bold whitespace-nowrap">Account Number:</span>
                  <span className="text-slate-700 text-right font-medium">{receiptData.accountNumber}</span>
                </div>
                <div className="flex justify-between items-start gap-4">
                  <span className="text-blue-500 font-bold whitespace-nowrap">Account Name:</span>
                  <span className="text-slate-700 text-right font-medium">{receiptData.holderName}</span>
                </div>
                <div className="flex justify-between items-start gap-4">
                  <span className="text-blue-500 font-bold whitespace-nowrap">Bank Name:</span>
                  <span className="text-slate-700 text-right font-medium">{receiptData.bankName}</span>
                </div>
                {receiptData.isError && receiptData.errorMessage && (
                   <div className="flex flex-col gap-1 pt-2 border-t border-slate-100 mt-2">
                     <span className="text-red-500 font-bold">Error Reason:</span>
                     <span className="text-slate-700 text-xs">{receiptData.errorMessage}</span>
                   </div>
                )}
                
                <div className="text-center text-[11px] font-medium text-slate-400 mt-6 pt-4">
                  © Copyright {new Date().getFullYear()} UsePay | All Rights Reserved.
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="p-4 bg-slate-50 flex justify-center gap-3 border-t border-slate-100 print:hidden">
                <button 
                  onClick={() => window.print()}
                  className="px-6 py-2 bg-white text-slate-700 border border-slate-300 font-bold rounded-lg shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  <Printer size={18} />
                  Print
                </button>
                <button 
                  onClick={() => setReceiptData(null)}
                  className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
