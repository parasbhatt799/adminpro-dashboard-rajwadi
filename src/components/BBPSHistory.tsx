import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Search,
  Calendar,
  Clock,
  Printer,
  ChevronRight,
  ShieldCheck,
  X,
  HelpCircle,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  Shield,
  IndianRupee,
  User,
  Phone,
  Loader2,
  CheckCircle2,
  XCircle,
  CreditCard,
  Hash,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { format, parseISO } from 'date-fns';
import { LogoLoader } from './shared/LoadingSpinner';
import * as XLSX from 'xlsx';
import { Link } from 'react-router-dom';
import UserDetails from './UserDetails';

interface BBPSTransaction {
  id: string;
  user_id: string;
  service_type: string;
  provider: string;
  consumer_number: string;
  amount: number;
  charges: number;
  status: string;
  transaction_id?: string;
  rejection_reason?: string;
  created_at: string;
  metadata?: any;
  users_profiles?: {
    name: string;
    firm_name: string;
    profile_photo_url?: string;
    mobile_number?: string;
    email?: string;
  };
}

export function getCategoryGatewayInfo(item: any): { key: string; label: string; badgeClass: string } {
  const st = String(item?.service_type || '').toLowerCase();
  const meta = item?.metadata || {};
  const gateway = String(meta.gateway || '').toLowerCase();
  const csplResp = meta.csplResponse;
  const rejReason = String(item?.rejection_reason || '').toLowerCase();

  // 1. Credit Card
  if (st.includes('credit card') || gateway.includes('credit card')) {
    return { key: 'Credit Card', label: 'Credit Card', badgeClass: 'bg-purple-50 text-purple-700 border border-purple-200' };
  }

  // 2. CSPL (Bill Payment 3)
  if (st.includes('cspl') || gateway.includes('cspl') || csplResp || rejReason.startsWith('cspl')) {
    return { key: 'CSPL BBPS', label: 'CSPL BBPS', badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200' };
  }

  // 3. BillAvenue (Bill Payment 2)
  if (st.includes('billavenue') || gateway.includes('billavenue') || meta.billerResponse || meta.bConnectTxnId) {
    return { key: 'BillAvenue BBPS', label: 'BillAvenue BBPS', badgeClass: 'bg-indigo-50 text-indigo-600 border border-indigo-200' };
  }

  // 4. PayPrime (Bill Payment 1)
  if (st.includes('payprime') || gateway.includes('payprime') || meta.fetchResponse) {
    return { key: 'PayPrime BBPS', label: 'PayPrime BBPS', badgeClass: 'bg-emerald-50 text-emerald-600 border border-emerald-200' };
  }

  // Default fallback if service_type exists, else Utility
  const fallbackLabel = item?.service_type || 'Utility';
  return { key: fallbackLabel, label: fallbackLabel, badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200' };
}

const getTodayStr = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

const getUtrOrTxnId = (item: any): string => {
  if (!item) return 'N/A';
  
  // Prioritize CC01 B-Connect Transaction Reference ID if available
  if (item.rejection_reason && String(item.rejection_reason).startsWith('CC01')) return item.rejection_reason;
  if (item.metadata?.txnRefId && String(item.metadata.txnRefId).startsWith('CC01')) return item.metadata.txnRefId;
  if (item.metadata?.txnid && String(item.metadata.txnid).startsWith('CC01')) return item.metadata.txnid;
  if (item.metadata?.bConnectTxnId && String(item.metadata.bConnectTxnId).startsWith('CC01')) return item.metadata.bConnectTxnId;
  if (item.metadata?.billerResponse?.txnRefId && String(item.metadata.billerResponse.txnRefId).startsWith('CC01')) return item.metadata.billerResponse.txnRefId;
  if (item.transaction_id && String(item.transaction_id).startsWith('CC01')) return item.transaction_id;

  // Helper to validate real UTR / Txn ID (excludes BA- internal idempotency keys)
  const isValidTxnId = (val: any): boolean => {
    if (!val) return false;
    const str = String(val).trim();
    if (!str || str === 'N/A' || str.startsWith('BA-')) return false;
    return true;
  };

  if (isValidTxnId(item.transaction_id)) return String(item.transaction_id);
  if (isValidTxnId(item.rejection_reason)) return String(item.rejection_reason);
  if (isValidTxnId(item.metadata?.bConnectTxnId)) return String(item.metadata.bConnectTxnId);
  if (isValidTxnId(item.metadata?.txnRefId)) return String(item.metadata.txnRefId);
  if (isValidTxnId(item.metadata?.txnid)) return String(item.metadata.txnid);
  if (isValidTxnId(item.metadata?.rrn)) return String(item.metadata.rrn);
  if (isValidTxnId(item.metadata?.reference)) return String(item.metadata.reference);
  if (isValidTxnId(item.metadata?.utr)) return String(item.metadata.utr);
  if (isValidTxnId(item.metadata?.billerResponse?.txnRefId)) return String(item.metadata.billerResponse.txnRefId);
  if (isValidTxnId(item.metadata?.billerResponse?.txnid)) return String(item.metadata.billerResponse.txnid);
  if (isValidTxnId(item.metadata?.rawFetchData?.txnid)) return String(item.metadata.rawFetchData.txnid);

  return 'N/A';
};

export default function BBPSHistory() {
  const [transactions, setTransactions] = useState<BBPSTransaction[]>([]);
  const [isBbpsEnabled, setIsBbpsEnabled] = useState(true);
  const [isBillAvenueEnabled, setIsBillAvenueEnabled] = useState(true);
  const [isCsplEnabled, setIsCsplEnabled] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchingHistory, setFetchingHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [utrFilter, setUtrFilter] = useState('');
  const [consumerNoFilter, setConsumerNoFilter] = useState('');
  const [mobileFilter, setMobileFilter] = useState('');
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending' | 'failed'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('today');
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  const [selectedReceipt, setSelectedReceipt] = useState<BBPSTransaction | null>(null);
  const [adminMap, setAdminMap] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedUserProfile, setSelectedUserProfile] = useState<any | null>(null);
  const [loadingProfileId, setLoadingProfileId] = useState<string | null>(null);
  const [checkingStatusId, setCheckingStatusId] = useState<string | null>(null);

  const handleCheckPendingStatus = async (item: BBPSTransaction) => {
    const utr = getUtrOrTxnId(item);
    const refId = (utr && utr !== 'N/A') ? utr : (item.rejection_reason || item.metadata?.requestId || item.transaction_id);

    if (!refId || refId === 'N/A') {
      alert("No valid Transaction ID / Reference ID available to check status.");
      return;
    }

    setCheckingStatusId(item.id);
    try {
      const trackType = String(refId).startsWith('CC01') ? 'TRANS_REF_ID' : 'REQUEST_ID';
      await fetch(`/api/bbps/status?requestId=${encodeURIComponent(refId)}&trackType=${trackType}`);
      await fetchTransactions(true);
    } catch (err) {
      console.error("Error checking pending status:", err);
    } finally {
      setCheckingStatusId(null);
    }
  };

  const handleViewUserProfile = async (userId: string, profileObj?: any) => {
    if (!userId) return;
    setLoadingProfileId(userId);
    try {
      const { data, error } = await supabase
        .from('users_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      if (data) {
        setSelectedUserProfile(data);
      } else if (profileObj) {
        setSelectedUserProfile(profileObj);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      if (profileObj) setSelectedUserProfile(profileObj);
    } finally {
      setLoadingProfileId(null);
    }
  };

  const getConsumerDetailsList = (item: BBPSTransaction) => {
    if (item.metadata?.consumerDetails && typeof item.metadata.consumerDetails === 'object') {
      const details = item.metadata.consumerDetails;
      const values: string[] = [];
      Object.keys(details).forEach(key => {
        const val = String(details[key] || '').trim();
        if (val && !values.includes(val)) {
          values.push(val);
        }
      });
      return values;
    }
    return item.consumer_number ? [item.consumer_number] : [];
  };

  const getCustomerMobileNumber = (item: any): string => {
    if (!item) return 'N/A';
    if (item.metadata?.customerMobile) return String(item.metadata.customerMobile);
    if (item.metadata?.mobile) return String(item.metadata.mobile);
    if (item.metadata?.mobileNumber) return String(item.metadata.mobileNumber);
    if (item.metadata?.customer_mobile) return String(item.metadata.customer_mobile);
    if (item.metadata?.customerDetails?.Mobile) return String(item.metadata.customerDetails.Mobile);
    if (item.metadata?.consumerDetails?.Mobile) return String(item.metadata.consumerDetails.Mobile);
    if (item.metadata?.consumerDetails?.['Mobile Number']) return String(item.metadata.consumerDetails['Mobile Number']);
    if (item.metadata?.consumerDetails?.['Customer Mobile']) return String(item.metadata.consumerDetails['Customer Mobile']);
    if (item.users_profiles?.mobile_number) return String(item.users_profiles.mobile_number);
    return 'N/A';
  };

  // Stats
  const [stats, setStats] = useState({
    count: 0,
    totalBase: 0,
    totalCharges: 0,
    totalDebited: 0,
    totalBbpsCommission: 0,
    successCount: 0,
    successAmount: 0,
    pendingCount: 0,
    pendingAmount: 0,
    failedCount: 0,
    failedAmount: 0
  });

  const clearFilters = () => {
    setSearchQuery('');
    setUtrFilter('');
    setConsumerNoFilter('');
    setMobileFilter('');
    setFilter('all');
    setCategoryFilter('all');
    setDateFilter('today');
    setStartDate(getTodayStr());
    setEndDate(getTodayStr());
  };

  const handleDateFilterChange = (value: string) => {
    setDateFilter(value);
    const today = new Date();
    
    const formatDate = (date: Date) => {
      const offset = date.getTimezoneOffset();
      const localDate = new Date(date.getTime() - (offset * 60 * 1000));
      return localDate.toISOString().split('T')[0];
    };

    if (value === 'today') {
      setStartDate(formatDate(today));
      setEndDate(formatDate(today));
    } else if (value === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      setStartDate(formatDate(yesterday));
      setEndDate(formatDate(yesterday));
    } else if (value === 'last7') {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      setStartDate(formatDate(start));
      setEndDate(formatDate(today));
    } else if (value === 'last30') {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      setStartDate(formatDate(start));
      setEndDate(formatDate(today));
    } else if (value === 'all' || value === 'custom') {
      setStartDate('');
      setEndDate('');
    }
  };

  const fetchTransactions = async (silent = false) => {
    if (!silent && transactions.length === 0) setLoading(true);
    else setFetchingHistory(true);

    try {
      // 1. Pre-query users_profiles if searchQuery is provided to match firm_name, name, mobile
      let userIds: string[] = [];
      if (searchQuery.trim()) {
        const term = searchQuery.trim();
        const safeTerm = term.replace(/"/g, '""');
        try {
          const { data: matchedUsers } = await supabase
            .from('users_profiles')
            .select('id')
            .or(`firm_name.ilike."%${safeTerm}%",name.ilike."%${safeTerm}%",mobile_number.ilike."%${safeTerm}%"`);
          if (matchedUsers && matchedUsers.length > 0) {
            userIds = matchedUsers.map(u => u.id);
          }
        } catch (uErr) {
          console.warn('Pre-query user profiles search warn:', uErr);
        }
      }

      // Fetch all records in batches of 1000 to bypass Supabase PostgREST default 1000-row limit
      let allData: any[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;
      let fetchError: any = null;

      while (hasMore) {
        let query = supabase
          .from('bbps_submissions')
          .select('*, users_profiles!bbps_submissions_user_id_fkey(id, name, firm_name, profile_photo_url, mobile_number, email)');

        // Apply Status Filter at DB level safely
        if (filter === 'approved') {
          query = query.in('status', ['approved', 'success', 'successful']);
        } else if (filter === 'pending') {
          query = query.in('status', ['pending', 'processing']);
        } else if (filter === 'failed') {
          query = query.in('status', ['failed', 'rejected', 'refunded']);
        }

        // Apply Search Filter (on user firm/name or biller details)
        if (searchQuery.trim()) {
          const term = searchQuery.trim();
          const safeTerm = term.replace(/"/g, '""');
          if (userIds.length > 0) {
            query = query.or(`consumer_number.ilike."%${safeTerm}%",provider.ilike."%${safeTerm}%",transaction_id.ilike."%${safeTerm}%",rejection_reason.ilike."%${safeTerm}%",service_type.ilike."%${safeTerm}%",user_id.in.(${userIds.join(',')})`);
          } else {
            query = query.or(`consumer_number.ilike."%${safeTerm}%",provider.ilike."%${safeTerm}%",transaction_id.ilike."%${safeTerm}%",rejection_reason.ilike."%${safeTerm}%",service_type.ilike."%${safeTerm}%"`);
          }
        }

        // Apply Date Filters
        if (startDate) {
          const [y, m, d] = startDate.split('-').map(Number);
          const startLocal = new Date(y, m - 1, d, 0, 0, 0, 0);
          query = query.gte('created_at', startLocal.toISOString());
        }
        if (endDate) {
          const [y, m, d] = endDate.split('-').map(Number);
          const endLocal = new Date(y, m - 1, d, 23, 59, 59, 999);
          query = query.lte('created_at', endLocal.toISOString());
        }

        const { data: chunkData, error } = await query
          .order('created_at', { ascending: false })
          .range(from, from + step - 1);

        if (error) {
          fetchError = error;
          break;
        }

        if (chunkData && chunkData.length > 0) {
          allData = allData.concat(chunkData);
          if (chunkData.length < step) {
            hasMore = false;
          } else {
            from += step;
          }
        } else {
          hasMore = false;
        }
      }

      let data = allData;
      let error = fetchError;

      // Fallback: If DB query failed, fetch base rows
      if (error) {
        console.warn('DB search/filter query failed, using base fallback:', error);
        let fallbackAll: any[] = [];
        let fbFrom = 0;
        let fbHasMore = true;

        while (fbHasMore) {
          let fallbackQuery = supabase
            .from('bbps_submissions')
            .select('*, users_profiles!bbps_submissions_user_id_fkey(id, name, firm_name, profile_photo_url, mobile_number, email)');

          if (startDate) {
            const [y, m, d] = startDate.split('-').map(Number);
            fallbackQuery = fallbackQuery.gte('created_at', new Date(y, m - 1, d, 0, 0, 0, 0).toISOString());
          }
          if (endDate) {
            const [y, m, d] = endDate.split('-').map(Number);
            fallbackQuery = fallbackQuery.lte('created_at', new Date(y, m - 1, d, 23, 59, 59, 999).toISOString());
          }

          const fallbackRes = await fallbackQuery
            .order('created_at', { ascending: false })
            .range(fbFrom, fbFrom + step - 1);

          if (!fallbackRes.error && fallbackRes.data && fallbackRes.data.length > 0) {
            fallbackAll = fallbackAll.concat(fallbackRes.data);
            if (fallbackRes.data.length < step) {
              fbHasMore = false;
            } else {
              fbFrom += step;
            }
          } else {
            fbHasMore = false;
          }
        }

        if (fallbackAll.length > 0) {
          data = fallbackAll;
          error = null;
        }
      }

      let filteredData = data || [];

      // 2. Fetch billavenue_transactions to enrich CC01 UTRs & statuses
      try {
        const { data: baTxns } = await supabase
          .from('billavenue_transactions')
          .select('id, request_id, txn_ref_id, customer_mobile, amount, status');

        if (baTxns && baTxns.length > 0) {
          const baReqMap = new Map<string, any>();
          const baTxnRefMap = new Map<string, any>();
          const baMobileAmtMap = new Map<string, any>();

          baTxns.forEach(ba => {
            if (ba.request_id) baReqMap.set(String(ba.request_id), ba);
            if (ba.txn_ref_id && ba.txn_ref_id !== 'N/A') baTxnRefMap.set(String(ba.txn_ref_id), ba);
            if (ba.customer_mobile && ba.amount) {
              const k = `${ba.customer_mobile}_${Number(ba.amount)}`;
              if (!baMobileAmtMap.has(k)) baMobileAmtMap.set(k, ba);
            }
          });

          filteredData = filteredData.map(item => {
            let baMatch = item.metadata?.requestId ? baReqMap.get(String(item.metadata.requestId)) : null;
            if (!baMatch && item.rejection_reason) baMatch = baTxnRefMap.get(String(item.rejection_reason));
            if (!baMatch) {
              const mob = getCustomerMobileNumber(item);
              if (mob && mob !== 'N/A') {
                const k = `${mob}_${Number(item.amount)}`;
                baMatch = baMobileAmtMap.get(k);
              }
            }

            if (baMatch) {
              const updatedMeta = { ...item.metadata };
              let updatedRejReason = item.rejection_reason;

              if (baMatch.txn_ref_id && baMatch.txn_ref_id !== 'N/A' && String(baMatch.txn_ref_id).startsWith('CC01')) {
                updatedMeta.bConnectTxnId = baMatch.txn_ref_id;
                updatedMeta.txnRefId = baMatch.txn_ref_id;
                if (!updatedRejReason || updatedRejReason === 'N/A' || String(updatedRejReason).startsWith('BA-')) {
                  updatedRejReason = baMatch.txn_ref_id;
                }
              }

              let updatedStatus = item.status;
              if (baMatch.status === 'success' || baMatch.status === 'approved') {
                updatedStatus = 'approved';
              } else if (baMatch.status === 'failed' || baMatch.status === 'rejected') {
                updatedStatus = 'rejected';
              }

              return {
                ...item,
                status: updatedStatus,
                rejection_reason: updatedRejReason,
                metadata: updatedMeta
              };
            }
            return item;
          });
        }
      } catch (enrichErr) {
        console.warn('Enrichment with billavenue_transactions failed:', enrichErr);
      }

      // Filter locally for status for 100% accuracy
      if (filter !== 'all') {
        filteredData = filteredData.filter(item => {
          const st = (item.status || '').toLowerCase();
          if (filter === 'approved') return st === 'approved' || st === 'success' || st === 'successful';
          if (filter === 'pending') return st === 'pending' || st === 'processing';
          if (filter === 'failed') return st === 'failed' || st === 'rejected' || st === 'refunded';
          return true;
        });
      }

      // Filter locally for categoryFilter for 100% precision
      if (categoryFilter !== 'all') {
        filteredData = filteredData.filter(item => {
          const catInfo = getCategoryGatewayInfo(item);
          return catInfo.key === categoryFilter;
        });
      }

      // Filter by Transaction UTR Filter
      if (utrFilter.trim()) {
        const uTerm = utrFilter.toLowerCase().trim();
        filteredData = filteredData.filter(item => {
          const utr = (getUtrOrTxnId(item)).toLowerCase();
          const rejReason = (item.rejection_reason || '').toLowerCase();
          const txnId = (item.transaction_id || '').toLowerCase();
          const bConnId = (item.metadata?.bConnectTxnId || '').toLowerCase();
          const refId = (item.metadata?.txnRefId || '').toLowerCase();
          return utr.includes(uTerm) || rejReason.includes(uTerm) || txnId.includes(uTerm) || bConnId.includes(uTerm) || refId.includes(uTerm);
        });
      }

      // Filter by Consumer Number / Card Number Filter
      if (consumerNoFilter.trim()) {
        const cTerm = consumerNoFilter.toLowerCase().trim();
        filteredData = filteredData.filter(item => {
          const consumerNo = (item.consumer_number || '').toLowerCase();
          const detailsList = getConsumerDetailsList(item).map(d => String(d).toLowerCase());
          return consumerNo.includes(cTerm) || detailsList.some(d => d.includes(cTerm));
        });
      }

      // Filter by Customer Mobile Number Filter
      if (mobileFilter.trim()) {
        const mTerm = mobileFilter.toLowerCase().trim();
        filteredData = filteredData.filter(item => {
          const mob = (getCustomerMobileNumber(item)).toLowerCase();
          const userMob = ((item.users_profiles as any)?.mobile_number || '').toLowerCase();
          return mob.includes(mTerm) || userMob.includes(mTerm);
        });
      }

      // Filter locally for search query
      if (searchQuery.trim()) {
        const term = searchQuery.toLowerCase().trim();
        filteredData = filteredData.filter(item => {
          const firmName = (item.users_profiles?.firm_name || '').toLowerCase();
          const userName = (item.users_profiles?.name || '').toLowerCase();
          const mobile = (getCustomerMobileNumber(item)).toLowerCase();
          const consumerNo = (item.consumer_number || '').toLowerCase();
          const provider = (item.provider || '').toLowerCase();
          const txId = (getUtrOrTxnId(item)).toLowerCase();
          const serviceType = (item.service_type || '').toLowerCase();
          const consumerDetailsStr = item.metadata?.consumerDetails ? JSON.stringify(item.metadata.consumerDetails).toLowerCase() : '';

          return firmName.includes(term) ||
            userName.includes(term) ||
            mobile.includes(term) ||
            consumerNo.includes(term) ||
            provider.includes(term) ||
            txId.includes(term) ||
            serviceType.includes(term) ||
            consumerDetailsStr.includes(term);
        });
      }

      setTransactions(filteredData);

      // Calculate Stats
      const statsObj = filteredData.reduce((acc, curr) => {
        const amt = Number(curr.amount) || 0;
        const chg = Number(curr.charges) || 0;
        const total = amt + chg;
        const st = (curr.status || '').toLowerCase();

        let succCount = acc.successCount;
        let succAmt = acc.successAmount;
        let pendCount = acc.pendingCount;
        let pendAmt = acc.pendingAmount;
        let failCount = acc.failedCount;
        let failAmt = acc.failedAmount;

        if (st === 'approved' || st === 'success' || st === 'successful') {
          succCount += 1;
          succAmt += total;
        } else if (st === 'pending' || st === 'processing') {
          pendCount += 1;
          pendAmt += total;
        } else if (st === 'failed' || st === 'rejected' || st === 'refunded') {
          failCount += 1;
          failAmt += total;
        }

        return {
          count: acc.count + 1,
          totalBase: acc.totalBase + amt,
          totalCharges: acc.totalCharges + chg,
          totalDebited: acc.totalDebited + total,
          totalBbpsCommission: acc.totalBbpsCommission + 0,
          successCount: succCount,
          successAmount: succAmt,
          pendingCount: pendCount,
          pendingAmount: pendAmt,
          failedCount: failCount,
          failedAmount: failAmt
        };
      }, {
        count: 0,
        totalBase: 0,
        totalCharges: 0,
        totalDebited: 0,
        totalBbpsCommission: 0,
        successCount: 0,
        successAmount: 0,
        pendingCount: 0,
        pendingAmount: 0,
        failedCount: 0,
        failedAmount: 0
      });

      setStats(statsObj);

      // Fetch admin list if not present
      if (Object.keys(adminMap).length === 0) {
        const { data: admins } = await supabase.from('admin_profiles').select('mobile_number, name');
        const map: Record<string, string> = {};
        admins?.forEach(a => {
          map[a.mobile_number] = a.name || a.mobile_number;
        });
        setAdminMap(map);
      }

    } catch (err) {
      console.error('Error fetching admin BBPS history:', err);
    } finally {
      setLoading(false);
      setFetchingHistory(false);
    }
  };

  const fetchBbpsSetting = async () => {
    try {
      const { data, error } = await supabase
        .from('qr_settings')
        .select('is_bbps_enabled, is_billavenue_enabled, is_cspl_enabled')
        .eq('id', 1)
        .single();
      if (!error && data) {
        setIsBbpsEnabled(data.is_bbps_enabled ?? true);
        setIsBillAvenueEnabled(data.is_billavenue_enabled ?? true);
        setIsCsplEnabled(data.is_cspl_enabled ?? false);
      }
    } catch (err) {
      console.error('Error fetching BBPS setting:', err);
    }
  };

  const handleToggleBbps = async () => {
    const newValue = !isBbpsEnabled;
    setIsBbpsEnabled(newValue);
    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from('qr_settings')
        .update({ is_bbps_enabled: newValue })
        .eq('id', 1);
      if (error) throw error;

      try {
        const { data } = await supabase.from('qr_settings').select('is_service_on_sound_enabled, is_service_off_sound_enabled, service_on_sound_url, service_off_sound_url').eq('id', 1).single();
        if (data) {
          const isSoundEnabled = newValue ? data.is_service_on_sound_enabled : data.is_service_off_sound_enabled;
          if (isSoundEnabled) {
            const soundUrl = newValue
              ? (data.service_on_sound_url || 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
              : (data.service_off_sound_url || 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            const audio = new Audio(soundUrl);
            audio.play().catch(() => { });
          }
        }
      } catch (soundErr) {
        console.error('Sound error:', soundErr);
      }
    } catch (err) {
      console.error('Error updating BBPS setting:', err);
      setIsBbpsEnabled(!newValue);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggleBillAvenue = async () => {
    const newValue = !isBillAvenueEnabled;
    setIsBillAvenueEnabled(newValue);
    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from('qr_settings')
        .update({ is_billavenue_enabled: newValue })
        .eq('id', 1);
      if (error) throw error;

      try {
        const { data } = await supabase.from('qr_settings').select('is_service_on_sound_enabled, is_service_off_sound_enabled, service_on_sound_url, service_off_sound_url').eq('id', 1).single();
        if (data) {
          const isSoundEnabled = newValue ? data.is_service_on_sound_enabled : data.is_service_off_sound_enabled;
          if (isSoundEnabled) {
            const soundUrl = newValue
              ? (data.service_on_sound_url || 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
              : (data.service_off_sound_url || 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            const audio = new Audio(soundUrl);
            audio.play().catch(() => { });
          }
        }
      } catch (soundErr) {
        console.error('Sound error:', soundErr);
      }
    } catch (err) {
      console.error('Error updating BillAvenue setting:', err);
      setIsBillAvenueEnabled(!newValue);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggleCspl = async () => {
    const newValue = !isCsplEnabled;
    setIsCsplEnabled(newValue);
    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from('qr_settings')
        .update({ is_cspl_enabled: newValue })
        .eq('id', 1);
      if (error) throw error;

      try {
        const { data } = await supabase.from('qr_settings').select('is_service_on_sound_enabled, is_service_off_sound_enabled, service_on_sound_url, service_off_sound_url').eq('id', 1).single();
        if (data) {
          const isSoundEnabled = newValue ? data.is_service_on_sound_enabled : data.is_service_off_sound_enabled;
          if (isSoundEnabled) {
            const soundUrl = newValue
              ? (data.service_on_sound_url || 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
              : (data.service_off_sound_url || 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            const audio = new Audio(soundUrl);
            audio.play().catch(() => { });
          }
        }
      } catch (soundErr) {
        console.error('Sound error:', soundErr);
      }
    } catch (err) {
      console.error('Error updating CSPL setting:', err);
      setIsCsplEnabled(!newValue);
    } finally {
      setSavingSettings(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchBbpsSetting();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('admin_bbps_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bbps_submissions'
      }, () => {
        fetchTransactions(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter, categoryFilter, searchQuery, startDate, endDate, utrFilter, consumerNoFilter, mobileFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, categoryFilter, searchQuery, startDate, endDate, utrFilter, consumerNoFilter, mobileFilter]);

  const handlePrint = () => {
    window.print();
  };

  // Export functions
  const exportToExcel = () => {
    try {
      const exportData = transactions.map(item => ({
        'Date': new Date(item.created_at).toLocaleDateString(),
        'Time': new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        'Firm Name': item.users_profiles?.firm_name || 'N/A',
        'User Name': item.users_profiles?.name || 'N/A',
        'Category': item.service_type.toUpperCase(),
        'Operator / Biller': item.provider,
        'Consumer Number': getConsumerDetailsList(item).join(' / '),
        'Customer Mobile': getCustomerMobileNumber(item),
        'Transaction UTR': getUtrOrTxnId(item),
        'Base Amount': Number(item.amount),
        'Service Charge': Number(item.charges),
        'BBPS Commission': 0,
        'Debited Total': Number(item.amount) + Number(item.charges),
        'Status': item.status.toUpperCase()
      }));

      // Append Total row
      exportData.push({
        'Date': 'TOTAL',
        'Time': '',
        'Firm Name': '',
        'User Name': '',
        'Category': '',
        'Operator / Biller': '',
        'Consumer Number': '',
        'Customer Mobile': '',
        'Transaction UTR': '',
        'Base Amount': Number(stats.totalBase.toFixed(2)),
        'Service Charge': Number(stats.totalCharges.toFixed(2)),
        'BBPS Commission': Number(stats.totalBbpsCommission.toFixed(2)),
        'Debited Total': Number(stats.totalDebited.toFixed(2)),
        'Status': ''
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 12 }, { wch: 10 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, 
        { wch: 25 }, { wch: 18 }, { wch: 16 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, 
        { wch: 15 }, { wch: 15 }, { wch: 12 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'BBPS Bill Payments');
      XLSX.writeFile(wb, `BBPS_Bill_History_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Excel Export Error:', err);
    }
  };

  const exportToPDF = async () => {
    try {
      const module = await import('jspdf');
      const JsPDFClass = module.jsPDF || module.default;
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = (autoTableModule.default || (autoTableModule as any).autoTable || autoTableModule) as any;
      const doc = new JsPDFClass({
        orientation: 'l',
        unit: 'mm',
        format: 'a4'
      });

      const tableData = transactions.map(item => [
        format(parseISO(item.created_at), 'dd/MM/yyyy HH:mm'),
        item.users_profiles?.firm_name || 'N/A',
        item.service_type.toUpperCase(),
        item.provider,
        getConsumerDetailsList(item).join(' / '),
        getCustomerMobileNumber(item),
        getUtrOrTxnId(item),
        item.status.toUpperCase(),
        Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        Number(item.charges).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        '0.00',
        (Number(item.amount) + Number(item.charges)).toLocaleString('en-IN', { minimumFractionDigits: 2 })
      ]);

      const footer = [
        [
          'TOTAL', '', '', '', '', '', '', '',
          stats.totalBase.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
          stats.totalCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
          stats.totalBbpsCommission.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
          stats.totalDebited.toLocaleString('en-IN', { minimumFractionDigits: 2 })
        ]
      ];

      autoTable(doc, {
        head: [['Date / Time', 'Firm Name', 'Category', 'Operator / Biller', 'Consumer No', 'Customer Mobile', 'Transaction UTR', 'Status', 'Base Amount', 'Charge', 'BBPS Comm', 'Debited']],
        body: tableData,
        foot: footer,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 8 },
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        margin: { top: 20 },
        didDrawPage: (data: any) => {
          doc.text('BBPS Bill History Report', data.settings.margin.left, 12);
        }
      });

      doc.save(`BBPS_Bill_History_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
    }
  };

  const itemsPerPage = 10;
  const totalPages = Math.ceil(transactions.length / itemsPerPage);
  const paginatedTransactions = transactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-8">
      {/* Dynamic print-only styling */}
      <AnimatePresence>
        {selectedReceipt && (
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              body * {
                visibility: hidden !important;
              }
              #history-receipt-modal, #history-receipt-modal * {
                visibility: visible !important;
              }
              #history-receipt-modal {
                position: absolute !important;
                left: 50% !important;
                top: 20px !important;
                transform: translateX(-50%) !important;
                width: 100% !important;
                max-width: 450px !important;
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
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Receipt className="text-indigo-600" size={28} />
            BBPS Bill History
          </h2>
          <p className="text-slate-500 mt-1">Monitor, filter, and export all real-time secure BBPS utility payments.</p>
        </div>
        
        {/* BBPS Service Toggle & Export Buttons */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* BBPS Toggle Switch */}
          <div className="flex items-center gap-2.5 bg-slate-100/80 px-4 py-2 rounded-xl border border-slate-200/50 shadow-sm h-[42px] select-none">
            <span className={`text-[10px] font-black uppercase tracking-widest ${isBbpsEnabled ? 'text-indigo-600' : 'text-slate-500'}`}>
              BBPS {isBbpsEnabled ? 'ON' : 'OFF'}
            </span>
            <button
              type="button"
              onClick={handleToggleBbps}
              disabled={savingSettings}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 cursor-pointer ${isBbpsEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isBbpsEnabled ? 'translate-x-4.5' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* BillAvenue Toggle Switch */}
          <div className="flex items-center gap-2.5 bg-slate-100/80 px-4 py-2 rounded-xl border border-slate-200/50 shadow-sm h-[42px] select-none">
            <span className={`text-[10px] font-black uppercase tracking-widest ${isBillAvenueEnabled ? 'text-indigo-600' : 'text-slate-500'}`}>
              Bill Payment 2 {isBillAvenueEnabled ? 'ON' : 'OFF'}
            </span>
            <button
              type="button"
              onClick={handleToggleBillAvenue}
              disabled={savingSettings}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 cursor-pointer ${isBillAvenueEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isBillAvenueEnabled ? 'translate-x-4.5' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* CSPL Toggle Switch */}
          <div className="flex items-center gap-2.5 bg-slate-100/80 px-4 py-2 rounded-xl border border-slate-200/50 shadow-sm h-[42px] select-none">
            <span className={`text-[10px] font-black uppercase tracking-widest ${isCsplEnabled ? 'text-indigo-600' : 'text-slate-500'}`}>
              CSPL {isCsplEnabled ? 'ON' : 'OFF'}
            </span>
            <button
              type="button"
              onClick={handleToggleCspl}
              disabled={savingSettings}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 cursor-pointer ${isCsplEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isCsplEnabled ? 'translate-x-4.5' : 'translate-x-1'}`} />
            </button>
          </div>

          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border border-emerald-200 cursor-pointer shadow-sm"
          >
            <FileSpreadsheet size={18} />
            Excel
          </button>
          <button 
            onClick={exportToPDF}
            className="flex items-center gap-2 bg-rose-50 text-rose-600 hover:bg-rose-100 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border border-rose-200 cursor-pointer shadow-sm"
          >
            <FileText size={18} />
            PDF
          </button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* TOTAL PAYMENTS */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Total Payments</p>
            <p className="text-xl font-black text-slate-950 leading-none">₹{stats.totalDebited.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            <span className="text-[10px] font-bold text-slate-500 mt-1 block">{stats.count} Txns</span>
          </div>
          <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
            <Receipt size={22} />
          </div>
        </div>

        {/* SUCCESS PAYMENTS */}
        <div 
          onClick={() => setFilter(filter === 'approved' ? 'all' : 'approved')}
          className={`p-5 rounded-3xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
            filter === 'approved' 
              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20 shadow-sm' 
              : 'bg-white border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/30'
          }`}
        >
          <div>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1.5">Total Success</p>
            <p className="text-xl font-black text-emerald-950 leading-none">₹{stats.successAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            <span className="text-[10px] font-bold text-emerald-700 mt-1 block">{stats.successCount} Txns</span>
          </div>
          <div className="w-11 h-11 bg-emerald-100/70 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
            <CheckCircle2 size={22} />
          </div>
        </div>

        {/* PENDING PAYMENTS */}
        <div 
          onClick={() => setFilter(filter === 'pending' ? 'all' : 'pending')}
          className={`p-5 rounded-3xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
            filter === 'pending' 
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20 shadow-sm' 
              : 'bg-white border-slate-200 hover:border-amber-200 hover:bg-amber-50/30'
          }`}
        >
          <div>
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-none mb-1.5">Total Pending</p>
            <p className="text-xl font-black text-amber-950 leading-none">₹{stats.pendingAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            <span className="text-[10px] font-bold text-amber-700 mt-1 block">{stats.pendingCount} Txns</span>
          </div>
          <div className="w-11 h-11 bg-amber-100/70 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
            <Clock size={22} />
          </div>
        </div>

        {/* REJECTED PAYMENTS */}
        <div 
          onClick={() => setFilter(filter === 'failed' ? 'all' : 'failed')}
          className={`p-5 rounded-3xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
            filter === 'failed' 
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/20 shadow-sm' 
              : 'bg-white border-slate-200 hover:border-rose-200 hover:bg-rose-50/30'
          }`}
        >
          <div>
            <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest leading-none mb-1.5">Total Rejected</p>
            <p className="text-xl font-black text-rose-950 leading-none">₹{stats.failedAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            <span className="text-[10px] font-bold text-rose-700 mt-1 block">{stats.failedCount} Txns</span>
          </div>
          <div className="w-11 h-11 bg-rose-100/70 text-rose-600 rounded-2xl flex items-center justify-center shrink-0">
            <XCircle size={22} />
          </div>
        </div>

        {/* CHARGES & BASE AMOUNT */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Base & Charges</p>
            <p className="text-xl font-black text-slate-950 leading-none">₹{stats.totalBase.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            <span className="text-[10px] font-bold text-indigo-600 mt-1 block">Charges: ₹{stats.totalCharges.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
            <Shield size={22} />
          </div>
        </div>
      </div>

      {/* Filter and Query bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        {/* Row 1: Dropdown Filters & General Search */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Quick Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={dateFilter}
              onChange={(e) => handleDateFilterChange(e.target.value)}
              className="px-4 py-2 h-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7">Last 7 Days</option>
              <option value="last30">Last 30 Days</option>
              <option value="custom">Custom</option>
            </select>

            {dateFilter === 'custom' && (
              <div className="flex items-center gap-2 h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">Start</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="text-xs font-bold text-slate-700 outline-none bg-transparent leading-none"
                  />
                </div>
                <div className="w-px h-6 bg-slate-200 mx-1"></div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">End</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="text-xs font-bold text-slate-700 outline-none bg-transparent leading-none"
                  />
                </div>
              </div>
            )}

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-4 py-2 h-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="approved">Success</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 h-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="PayPrime BBPS">Bill Payment 1 (PayPrime)</option>
              <option value="BillAvenue BBPS">Bill Payment 2 (BillAvenue)</option>
              <option value="CSPL BBPS">Bill Payment 3 (CSPL)</option>
              <option value="Credit Card">Credit Card</option>
            </select>

            <button
              onClick={clearFilters}
              className="px-3 py-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-slate-200 bg-white cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-2xs"
              title="Clear All Filters"
            >
              <RotateCcw size={15} />
              <span>Reset</span>
            </button>
          </div>

          {/* General Search bar */}
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search Firm, Name, Operator..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-8 py-2 h-10 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: 3 Dedicated Specific Filters (UTR, Card/Consumer No, Mobile Number) */}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Filter 1: Transaction UTR */}
          <div className="relative">
            <Receipt className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500" size={15} />
            <input
              type="text"
              placeholder="Filter by Transaction UTR / CC01..."
              value={utrFilter}
              onChange={(e) => setUtrFilter(e.target.value)}
              className="w-full pl-9 pr-8 py-2 h-10 bg-indigo-50/40 border border-indigo-100 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            />
            {utrFilter && (
              <button
                type="button"
                onClick={() => setUtrFilter('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter 2: Card Number / Consumer Number */}
          <div className="relative">
            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" size={15} />
            <input
              type="text"
              placeholder="Filter by Card / Consumer Number..."
              value={consumerNoFilter}
              onChange={(e) => setConsumerNoFilter(e.target.value)}
              className="w-full pl-9 pr-8 py-2 h-10 bg-emerald-50/40 border border-emerald-100 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
            />
            {consumerNoFilter && (
              <button
                type="button"
                onClick={() => setConsumerNoFilter('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter 3: Customer Mobile Number */}
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500" size={15} />
            <input
              type="text"
              placeholder="Filter by Customer Mobile..."
              value={mobileFilter}
              onChange={(e) => setMobileFilter(e.target.value)}
              className="w-full pl-9 pr-8 py-2 h-10 bg-amber-50/40 border border-amber-100 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
            />
            {mobileFilter && (
              <button
                type="button"
                onClick={() => setMobileFilter('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid / Table container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative">
        {fetchingHistory && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <div className="bg-white p-3 rounded-full shadow-lg border border-slate-100 flex items-center justify-center">
              <LogoLoader size="sm" />
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-center">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left">Firm / Date</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Operator / Provider</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Consumer Number</th>
                <th className="px-6 py-4 text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Customer Mobile</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transaction UTR</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Base Amt</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-rose-500">Charges</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-indigo-500">BBPS Comm</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-6 py-16 text-center">
                    <LogoLoader size="md" className="mx-auto" />
                    <p className="text-xs text-slate-400 font-bold uppercase mt-3">Fetching transaction records...</p>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-16 text-center space-y-4 text-slate-400">
                    <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                      <HelpCircle size={24} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-700">No BBPS Transactions Found</h4>
                      <p className="text-xs text-slate-400 mt-1">Adjust filters or search parameters to locate entries.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* User Profile / Date */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleViewUserProfile(item.user_id, item.users_profiles)}
                          className="w-8 h-8 bg-indigo-50 hover:bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 shrink-0 transition-colors cursor-pointer"
                          title="Click to view User Profile"
                        >
                          {loadingProfileId === item.user_id ? (
                            <Loader2 size={14} className="animate-spin text-indigo-600" />
                          ) : item.users_profiles?.profile_photo_url ? (
                            <img src={item.users_profiles.profile_photo_url} alt="" className="w-full h-full object-cover rounded-full" />
                          ) : (
                            <User size={16} />
                          )}
                        </button>
                        <div>
                          <button
                            type="button"
                            onClick={() => handleViewUserProfile(item.user_id, item.users_profiles)}
                            className="text-xs font-bold text-slate-900 hover:text-indigo-600 hover:underline leading-none text-left cursor-pointer transition-colors block"
                            title="Click to view User Profile"
                          >
                            {item.users_profiles?.firm_name || item.users_profiles?.name || `User #${item.user_id?.slice(0, 8) || 'N/A'}`}
                          </button>
                          {item.users_profiles?.firm_name && item.users_profiles?.name && (
                            <p className="text-[10px] text-slate-500 font-medium leading-none mt-1">
                              {item.users_profiles.name}
                            </p>
                          )}
                          <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 leading-none">
                            {format(parseISO(item.created_at), 'dd MMM yyyy')} • {format(parseISO(item.created_at), 'hh:mm a')}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-6 py-4 text-center">
                      {(() => {
                        const catInfo = getCategoryGatewayInfo(item);
                        return (
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase whitespace-nowrap ${catInfo.badgeClass}`}>
                            {catInfo.label}
                          </span>
                        );
                      })()}
                    </td>

                    {/* Provider */}
                    <td className="px-6 py-4 text-center">
                      <p className="text-xs font-black text-slate-800 leading-snug">{item.provider}</p>
                    </td>

                    {/* Consumer No */}
                    <td className="px-6 py-4 text-center">
                      {(() => {
                        const vals = getConsumerDetailsList(item);
                        if (vals.length === 0) return <p className="text-xs font-bold text-slate-400">N/A</p>;
                        if (vals.length === 1) return <p className="text-xs font-bold text-slate-600 font-mono">{vals[0]}</p>;
                        return (
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <span className="text-xs font-black text-slate-800 font-mono leading-none">{vals[0]}</span>
                            <span className="text-[10px] text-slate-400 font-bold font-mono leading-none">{vals[1]}</span>
                          </div>
                        );
                      })()}
                    </td>

                    {/* Customer Mobile */}
                    <td className="px-6 py-4 text-center">
                      <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50/60 px-2 py-0.5 rounded border border-indigo-100/60">
                        {getCustomerMobileNumber(item)}
                      </span>
                    </td>

                    {/* Transaction ID */}
                    <td className="px-6 py-4 text-center">
                      <p className="text-xs font-mono font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-100/50 w-fit mx-auto">
                        {getUtrOrTxnId(item)}
                      </p>
                    </td>

                    {/* Amounts */}
                    <td className="px-6 py-4 text-center">
                      <p className="text-xs font-bold text-slate-900">₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <p className="text-xs font-bold text-rose-600">₹{Number(item.charges || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <p className="text-xs font-bold text-indigo-600">₹0.00</p>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <p className="text-xs font-black text-emerald-600">₹{(Number(item.amount) + Number(item.charges || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                          item.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                          item.status === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                          'bg-rose-50 text-rose-600 border border-rose-100'
                        }`}>
                          {item.status === 'approved' ? 'Success' : item.status}
                        </span>
                        {item.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => handleCheckPendingStatus(item)}
                            disabled={checkingStatusId === item.id}
                            className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-2xs"
                            title="Check Live Status with Gateway & Update Database"
                          >
                            {checkingStatusId === item.id ? (
                              <Loader2 size={10} className="animate-spin text-indigo-600" />
                            ) : (
                              <RotateCcw size={10} />
                            )}
                            Check Status
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Print Action */}
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setSelectedReceipt(item)}
                        className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-xl transition-all flex items-center justify-center mx-auto cursor-pointer border border-slate-200"
                        title="View & Print E-Receipt"
                      >
                        <Printer size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-slate-100 mt-0">
            <p className="text-xs text-slate-500 font-medium">
              Showing <span className="text-slate-900 font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-slate-900 font-bold">{Math.min(currentPage * itemsPerPage, transactions.length)}</span> of <span className="text-slate-900 font-bold">{transactions.length}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Prev
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* POPUP RECEIPT OVERLAY MODAL */}
      <AnimatePresence>
        {selectedReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Dark background blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedReceipt(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm print:hidden"
            />

            {/* Receipt container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative z-10 w-full max-w-md bg-white border border-slate-200 rounded-[36px] p-8 shadow-2xl space-y-6 print:border-0 print:shadow-none"
              id="history-receipt-modal"
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedReceipt(null)}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-all print:hidden cursor-pointer"
              >
                <X size={20} />
              </button>

              {/* Secure logo decoration */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full flex items-center justify-center pointer-events-none print:hidden">
                <ShieldCheck size={18} className="text-emerald-500/20 translate-x-3 -translate-y-3" />
              </div>

              {/* Receipt Header */}
              <div className="text-center border-b border-dashed border-slate-200 pb-6">
                <div className="flex flex-col items-center justify-center gap-3">
                  <img src="/logo_receipt.png" alt="UsePay" className="h-10 w-auto object-contain" />
                  <span className="text-[10px] bg-slate-900 text-white px-3 py-1 rounded-full font-black uppercase tracking-[0.2em]">BBPS E-Receipt</span>
                </div>
                <div className="text-3xl font-black text-slate-800 mt-4">
                  ₹{(Number(selectedReceipt.amount) + Number(selectedReceipt.charges || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-[10px] text-slate-400 font-bold mt-1">
                  (Base: ₹{Number(selectedReceipt.amount).toLocaleString('en-IN')} + Commission: ₹{Number(selectedReceipt.charges).toLocaleString('en-IN')})
                </p>
                {selectedReceipt.status === 'approved' || selectedReceipt.status === 'success' || selectedReceipt.status === 'successful' ? (
                  <p className="text-xs font-black text-emerald-600 uppercase tracking-widest mt-2">Transaction Success</p>
                ) : selectedReceipt.status === 'pending' || selectedReceipt.status === 'processing' ? (
                  <p className="text-xs font-black text-amber-600 uppercase tracking-widest mt-2">Transaction Pending</p>
                ) : (
                  <p className="text-xs font-black text-rose-600 uppercase tracking-widest mt-2">Transaction Failed</p>
                )}
              </div>

              {/* Slate Receipt detail rows */}
              <div className="space-y-4 text-xs font-medium text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Retailer / Firm</span>
                  <span className="font-black text-slate-800 text-right">
                    {selectedReceipt.users_profiles?.firm_name || selectedReceipt.users_profiles?.name || 'N/A'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Category</span>
                  <span className="font-black text-slate-800 text-right uppercase">
                    {selectedReceipt.service_type}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Operator</span>
                  <span className="font-black text-slate-800 text-right">
                    {selectedReceipt.metadata?.billerName || selectedReceipt.provider}
                  </span>
                </div>

                {/* Display consumer parameters */}
                {selectedReceipt.metadata?.consumerDetails ? (
                  Object.entries(selectedReceipt.metadata.consumerDetails).map(([key, val]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-slate-400 font-bold uppercase tracking-wider">{key}</span>
                      <span className="font-black text-slate-800 text-right">{String(val)}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold uppercase tracking-wider">Consumer ID</span>
                    <span className="font-black text-slate-800 text-right">{selectedReceipt.consumer_number}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Transaction UTR</span>
                  <span className="font-black text-slate-800 font-mono text-[11px] bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                    {getUtrOrTxnId(selectedReceipt)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Date & Time</span>
                  <span className="font-black text-slate-800 text-right font-mono">
                    {selectedReceipt.metadata?.date || format(parseISO(selectedReceipt.created_at), 'dd/MM/yyyy, hh:mm a')}
                  </span>
                </div>
              </div>

              {/* Secure footer mark */}
              <div className="border-t border-slate-100 pt-6 flex items-center justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">
                <div className="flex items-center gap-1">
                  <ShieldCheck size={12} className="text-emerald-500" />
                  Secure BBPS Gateway
                </div>
                <span>Ref ID: {getUtrOrTxnId(selectedReceipt).substring(0, 8)}</span>
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
            </motion.div>
          </div>
        )}
        {/* User Details Profile Modal Overlay */}
        {selectedUserProfile && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/65 backdrop-blur-md no-scrollbar"
            onClick={() => setSelectedUserProfile(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[32px] w-[94vw] max-w-6xl max-h-[90vh] flex flex-col shadow-2xl relative border border-slate-200 overflow-hidden my-auto"
            >
              {/* Modal Top Sticky Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/90 backdrop-blur-sm shrink-0">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                  <div className="flex items-baseline gap-2">
                    <h3 className="font-black text-slate-900 text-base tracking-tight">
                      User Profile & Account Details
                    </h3>
                    <span className="text-xs font-bold text-slate-400 hidden sm:inline-block">
                      — {selectedUserProfile.firm_name || selectedUserProfile.name} ({selectedUserProfile.name})
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUserProfile(null)}
                  className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 rounded-full transition-all cursor-pointer"
                  title="Close Profile Modal"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Content Body */}
              <div className="p-6 md:p-8 pb-16 overflow-y-auto no-scrollbar flex-1">
                <UserDetails
                  user={selectedUserProfile}
                  isModal={true}
                  onBack={() => setSelectedUserProfile(null)}
                  onEdit={() => {}}
                  onDelete={() => setSelectedUserProfile(null)}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
