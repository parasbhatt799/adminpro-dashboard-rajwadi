import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import B2BAPIBillHistory from '../shared/B2BAPIBillHistory';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function B2BAgentBillHistory() {
  const navigate = useNavigate();
  const agentId = localStorage.getItem('b2bAgentId') || undefined;
  const [loading, setLoading] = useState(true);
  const [isAllowed, setIsAllowed] = useState(true);

  useEffect(() => {
    if (!agentId) {
      setLoading(false);
      return;
    }
    supabase
      .from('b2b_api_credentials')
      .select('is_bbps_enabled')
      .eq('id', agentId)
      .single()
      .then(({ data, error }) => {
        if (!error && data && data.is_bbps_enabled === false) {
          setIsAllowed(false);
        }
        setLoading(false);
      });
  }, [agentId]);

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-12 text-center max-w-lg mx-auto shadow-2xl space-y-4 my-8">
        <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto text-amber-400">
          <ShieldAlert size={32} />
        </div>
        <h3 className="text-xl font-bold text-white">Bill Payment Service Not Active</h3>
        <p className="text-slate-400 text-sm">
          Your B2B agent profile does not have the BBPS Bill Payment service enabled. Please contact support or your administrator to activate this service.
        </p>
        <button
          onClick={() => navigate('/b2b/agent/dashboard')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md cursor-pointer"
        >
          <ArrowLeft size={16} /> Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <B2BAPIBillHistory isAdmin={false} agentId={agentId} />
    </div>
  );
}
