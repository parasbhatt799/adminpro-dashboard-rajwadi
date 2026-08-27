import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';
import { Wallet, ShieldCheck, Activity, ArrowUpRight, Crown, User, PlusCircle, History, Search, Trash2, Clock, Landmark } from 'lucide-react';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { format } from 'date-fns';

export default function B2BAdminWithdrawals() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Gross Earnings from Logs
  const [grossTotalRevenue, setGrossTotalRevenue] = useState<number>(0);
  const [grossDeveloperEarnings, setGrossDeveloperEarnings] = useState<number>(0);
  const [grossOwnerEarnings, setGrossOwnerEarnings] = useState<number>(0);

  // Withdrawals List from DB
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  // Form State
  const [selectedRole, setSelectedRole] = useState<'developer' | 'owner' | 'general'>('general');
  const [amount, setAmount] = useState<string>('');
  const [remark, setRemark] = useState<string>('');

  // Table Filter Search
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    fetchData();

    // Realtime listeners
    const logsChannel = supabase
      .channel('b2b_withdrawals_logs_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'b2b_api_logs' },
        () => fetchData()
      )
      .subscribe();

    const withdrawalsChannel = supabase
      .channel('b2b_withdrawals_db_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'b2b_revenue_withdrawals' },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(logsChannel);
      supabase.removeChannel(withdrawalsChannel);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch all successful pay-bill logs to calculate gross earnings
      let allLogs: any[] = [];
      let from = 0;
      let step = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('b2b_api_logs')
          .select('charge_deducted, developer_charge, owner_charge, request_payload, response_payload, status_code, endpoint')
          .or("endpoint.eq./api/b2b/pay-bill,endpoint.eq./api/v1/b2b/pay-bill")
          .range(from, from + step - 1);

        if (error) {
          console.error('Error fetching logs batch:', error);
          break;
        }

        if (data && data.length > 0) {
          allLogs = allLogs.concat(data);
          if (data.length < step) {
            hasMore = false;
          } else {
            from += step;
          }
        } else {
          hasMore = false;
        }
      }

      let totalSum = 0;
      let devSum = 0;
      let ownerSum = 0;

      allLogs.forEach((log) => {
        const req = log.request_payload || {};
        const res = log.response_payload || {};
        const bpr = res?.ExtBillPayResponse || res?.billPayResponse || res;
        const txnRefId = bpr?.txnRefId || res?.txnRefId;
        const hasCC01 = !!(txnRefId && String(txnRefId).toUpperCase().startsWith('CC01'));
        const responseCode = bpr?.responseCode || res?.responseCode;
        const responseReason = (bpr?.responseReason || res?.responseReason || '').toLowerCase();

        const isSuccess =
          res?.payment_status === 'success' ||
          res?.finalStatus === 'success' ||
          res?.status === 'success' ||
          responseCode === '000' ||
          responseCode === '0000' ||
          responseReason === 'successful' ||
          (hasCC01 && log.status_code === 200 && res?.payment_status !== 'failed');

        if (!isSuccess) return;

        const chargeVal = Number(
          log.charge_deducted ??
          req?.chargeDeducted ??
          req?.chargePerBill ??
          req?.charge ??
          (req?.totalDeduction && req?.amount ? req.totalDeduction - req.amount : undefined) ??
          0
        );

        let dVal = Number(log.developer_charge ?? req?.developerCharge ?? req?.developer_charge ?? 0);
        let oVal = Number(log.owner_charge ?? req?.ownerCharge ?? req?.owner_charge ?? (chargeVal - dVal));

        totalSum += chargeVal;
        devSum += dVal;
        ownerSum += oVal;
      });

      setGrossTotalRevenue(totalSum);
      setGrossDeveloperEarnings(devSum);
      setGrossOwnerEarnings(ownerSum);

      // 2. Fetch withdrawal records from b2b_revenue_withdrawals
      const { data: wData, error: wErr } = await supabase
        .from('b2b_revenue_withdrawals')
        .select('*')
        .order('created_at', { ascending: false });

      if (wErr) {
        console.warn('b2b_revenue_withdrawals table error:', wErr.message);
        setWithdrawals([]);
      } else {
        setWithdrawals(wData || []);
      }

    } catch (err) {
      console.error('Error fetching withdrawal data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate Withdrawn Totals by Category
  const { totalDevWithdrawn, totalOwnerWithdrawn, totalGeneralWithdrawn } = useMemo(() => {
    let devW = 0;
    let ownerW = 0;
    let genW = 0;

    withdrawals.forEach((w) => {
      const amt = Number(w.amount || 0);
      if (w.role === 'developer') devW += amt;
      else if (w.role === 'owner') ownerW += amt;
      else genW += amt; // 'general' or any other
    });

    return {
      totalDevWithdrawn: devW,
      totalOwnerWithdrawn: ownerW,
      totalGeneralWithdrawn: genW
    };
  }, [withdrawals]);

  // Calculated Net Balances
  const netDeveloperBalance = grossDeveloperEarnings - totalDevWithdrawn;
  const netOwnerBalance = grossOwnerEarnings - totalOwnerWithdrawn;
  const totalAllWithdrawn = totalDevWithdrawn + totalOwnerWithdrawn + totalGeneralWithdrawn;
  const netTotalRevenue = grossTotalRevenue - totalAllWithdrawn;

  // Available balance for currently selected radio option
  const availableBalForSelected =
    selectedRole === 'developer'
      ? netDeveloperBalance
      : selectedRole === 'owner'
      ? netOwnerBalance
      : netTotalRevenue;

  const roleLabel =
    selectedRole === 'developer'
      ? 'Developer Share'
      : selectedRole === 'owner'
      ? 'Owner Share'
      : 'Total Net API Revenue';

  // Submit Withdrawal Entry
  const handleSubmitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid positive withdrawal amount.');
      return;
    }

    let warningText = '';
    if (numAmount > availableBalForSelected) {
      warningText = `\n\n⚠️ WARNING: Requested amount (₹${numAmount.toLocaleString('en-IN')}) is greater than available ${roleLabel} balance (₹${availableBalForSelected.toLocaleString('en-IN')}). Balance will become negative!`;
    }

    if (!window.confirm(`Are you sure you want to log a withdrawal of ₹${numAmount.toLocaleString('en-IN')} from [ ${roleLabel} ]?${warningText}`)) {
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('b2b_revenue_withdrawals')
        .insert({
          role: selectedRole,
          amount: numAmount,
          remark: remark.trim() || `Direct ${roleLabel} withdrawal`
        });

      if (error) throw error;

      toast.success(`Withdrawal of ₹${numAmount.toLocaleString('en-IN')} for [ ${roleLabel} ] logged successfully!`);
      setAmount('');
      setRemark('');
      fetchData();
    } catch (err: any) {
      console.error('Error logging withdrawal:', err);
      if (err.message && err.message.includes('b2b_revenue_withdrawals_role_check')) {
        toast.error('SQL Constraint Error: Please update the constraint in Supabase SQL Editor!');
        alert('⚠️ Supabase SQL Constraint Error!\n\nYour existing Supabase table only allowed (\'developer\', \'owner\'). Please copy & run this query in your Supabase SQL Editor to allow \'general\' role:\n\nALTER TABLE public.b2b_revenue_withdrawals DROP CONSTRAINT IF EXISTS b2b_revenue_withdrawals_role_check;\nALTER TABLE public.b2b_revenue_withdrawals ADD CONSTRAINT b2b_revenue_withdrawals_role_check CHECK (role IN (\'developer\', \'owner\', \'general\'));');
      } else {
        toast.error(err.message || 'Failed to log withdrawal.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Withdrawal Entry
  const handleDeleteWithdrawal = async (id: string, role: string, amt: number) => {
    const rLabel =
      role === 'developer'
        ? 'Developer Share'
        : role === 'owner'
        ? 'Owner Share'
        : 'Total Net API Revenue';

    if (!window.confirm(`Are you sure you want to delete this withdrawal entry of ₹${amt.toLocaleString('en-IN')} for [ ${rLabel} ]? This will RESTORE the balance.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('b2b_revenue_withdrawals')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success(`Withdrawal entry deleted and ₹${amt.toLocaleString('en-IN')} restored to balance!`);
      fetchData();
    } catch (err: any) {
      console.error('Error deleting withdrawal:', err);
      toast.error('Failed to delete withdrawal entry.');
    }
  };

  // Filtered Withdrawals List
  const filteredWithdrawals = withdrawals.filter((w) => {
    const term = searchTerm.toLowerCase();
    const roleStr = (w.role || '').toLowerCase();
    const remarkStr = (w.remark || '').toLowerCase();
    const amountStr = String(w.amount || '');

    return roleStr.includes(term) || remarkStr.includes(term) || amountStr.includes(term);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <ArrowUpRight className="h-6 w-6 text-indigo-400" />
            Revenue Withdrawals
          </h2>
          <p className="text-slate-400">Directly deduct payouts from Total API Revenue, Developer Share, or Owner Share.</p>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Net API Revenue Card */}
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-6 shadow-xl backdrop-blur-md relative overflow-hidden group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">Total Net API Revenue</span>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
              </div>
              <div className="text-lg sm:text-xl font-bold text-emerald-300 tracking-tight mb-2 truncate">
                ₹ {netTotalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 flex items-center justify-between border-t border-emerald-500/20 pt-3 mt-1">
                <span>Gross: <strong className="text-slate-200">₹{grossTotalRevenue.toLocaleString('en-IN')}</strong></span>
                <span>Total Withdrawn: <strong className="text-emerald-400">₹{totalAllWithdrawn.toLocaleString('en-IN')}</strong></span>
              </div>
            </div>

            {/* Developer Share Card */}
            <div className="bg-blue-950/40 border border-blue-500/30 rounded-2xl p-6 shadow-xl backdrop-blur-md relative overflow-hidden group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-4 h-4 text-blue-400" />
                  Developer Available Balance
                </span>
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Activity className="w-6 h-6" />
                </div>
              </div>
              <div className="text-lg sm:text-xl font-bold text-blue-300 tracking-tight mb-2 truncate">
                ₹ {netDeveloperBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 flex items-center justify-between border-t border-blue-500/20 pt-3 mt-1">
                <span>Earned: <strong className="text-slate-200">₹{grossDeveloperEarnings.toLocaleString('en-IN')}</strong></span>
                <span>Withdrawn: <strong className="text-rose-400">₹{totalDevWithdrawn.toLocaleString('en-IN')}</strong></span>
              </div>
            </div>

            {/* Owner Share Card */}
            <div className="bg-purple-950/40 border border-purple-500/30 rounded-2xl p-6 shadow-xl backdrop-blur-md relative overflow-hidden group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-purple-400" />
                  Owner Available Balance
                </span>
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Wallet className="w-6 h-6" />
                </div>
              </div>
              <div className="text-lg sm:text-xl font-bold text-purple-300 tracking-tight mb-2 truncate">
                ₹ {netOwnerBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 flex items-center justify-between border-t border-purple-500/20 pt-3 mt-1">
                <span>Earned: <strong className="text-slate-200">₹{grossOwnerEarnings.toLocaleString('en-IN')}</strong></span>
                <span>Withdrawn: <strong className="text-rose-400">₹{totalOwnerWithdrawn.toLocaleString('en-IN')}</strong></span>
              </div>
            </div>
          </div>

          {/* Direct Withdrawal Form Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
              <PlusCircle className="h-5 w-5 text-indigo-400" />
              Direct Withdrawal Form
            </h3>

            <form onSubmit={handleSubmitWithdrawal} className="space-y-5">
              {/* Radio Selection: 3 Options */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Select Payout Account / Target
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Total Net API Revenue Option */}
                  <label
                    className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedRole === 'general'
                        ? 'bg-emerald-950/50 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="general"
                      checked={selectedRole === 'general'}
                      onChange={() => setSelectedRole('general')}
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 bg-slate-900 border-slate-700 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs sm:text-sm flex items-center gap-1.5 text-emerald-300">
                          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                          Total Net API Revenue
                        </span>
                      </div>
                      <div className="text-xs font-mono text-emerald-400 font-bold mt-1">
                        Bal: ₹{netTotalRevenue.toLocaleString('en-IN')}
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Deducts ONLY from Total Net API Revenue</span>
                    </div>
                  </label>

                  {/* Developer Option */}
                  <label
                    className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedRole === 'developer'
                        ? 'bg-blue-950/50 border-blue-500 text-white shadow-lg shadow-blue-500/10'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="developer"
                      checked={selectedRole === 'developer'}
                      onChange={() => setSelectedRole('developer')}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 bg-slate-900 border-slate-700 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs sm:text-sm flex items-center gap-1.5 text-blue-300">
                          <User className="w-4 h-4 text-blue-400 shrink-0" />
                          Developer Share
                        </span>
                      </div>
                      <div className="text-xs font-mono text-blue-400 font-bold mt-1">
                        Bal: ₹{netDeveloperBalance.toLocaleString('en-IN')}
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Deducts from Developer Share & Revenue</span>
                    </div>
                  </label>

                  {/* Owner Option */}
                  <label
                    className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedRole === 'owner'
                        ? 'bg-purple-950/50 border-purple-500 text-white shadow-lg shadow-purple-500/10'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="owner"
                      checked={selectedRole === 'owner'}
                      onChange={() => setSelectedRole('owner')}
                      className="w-4 h-4 text-purple-600 focus:ring-purple-500 bg-slate-900 border-slate-700 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs sm:text-sm flex items-center gap-1.5 text-purple-300">
                          <Crown className="w-4 h-4 text-purple-400 shrink-0" />
                          Owner Share
                        </span>
                      </div>
                      <div className="text-xs font-mono text-purple-400 font-bold mt-1">
                        Bal: ₹{netOwnerBalance.toLocaleString('en-IN')}
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Deducts from Owner Share & Revenue</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Amount & Remark Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Withdrawal Amount (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 5000"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      className="w-full pl-8 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Remark / Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Server costs / Personal withdrawal"
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || !amount}
                  className="px-6 py-3 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>{submitting ? 'Processing Withdrawal...' : 'Log & Deduct Withdrawal'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Withdrawal History Table */}
          <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-950/50">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <History className="h-5 w-5 text-indigo-400" />
                Withdrawal Log History
              </h3>

              <div className="relative max-w-xs w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by role, remark, amount..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 border border-slate-700 rounded-xl text-xs bg-slate-950 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              {filteredWithdrawals.length === 0 ? (
                <div className="text-center p-8 text-slate-400 text-sm">
                  No withdrawal records found.
                </div>
              ) : (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-950/60 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-3">Date & Time</th>
                      <th className="px-6 py-3">Target Account</th>
                      <th className="px-6 py-3">Withdrawn Amount</th>
                      <th className="px-6 py-3">Remark / Note</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredWithdrawals.map((w) => (
                      <tr key={w.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 text-slate-300 text-xs flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          {format(new Date(w.created_at), 'dd MMM yyyy, hh:mm a')}
                        </td>
                        <td className="px-6 py-4">
                          {w.role === 'developer' ? (
                            <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 inline-flex items-center gap-1">
                              <User className="w-3.5 h-3.5" /> Developer Share
                            </span>
                          ) : w.role === 'owner' ? (
                            <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 inline-flex items-center gap-1">
                              <Crown className="w-3.5 h-3.5" /> Owner Share
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5" /> Total Net API Revenue
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-rose-400 text-base font-mono">
                            - ₹{Number(w.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-300 text-xs">
                          {w.remark || <span className="italic text-slate-500">No remark</span>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDeleteWithdrawal(w.id, w.role, Number(w.amount))}
                            className="p-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 rounded-lg transition-colors cursor-pointer"
                            title="Delete withdrawal & restore balance"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
