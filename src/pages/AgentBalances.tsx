import React, { useState } from 'react';
import { Wallet, Search, AlertCircle, CheckCircle2, ChevronRight, Activity } from 'lucide-react';

export default function AgentBalances() {
  const [agentId, setAgentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const checkBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentId.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/recharge/agent-deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agentId.trim() })
      });
      const data = await res.json();
      
      if (data && data.status === "ERROR") {
        setError(data.message || "Failed to fetch balance");
      } else if (data && (data.DepositEnquiryResponse || data.depositEnquiryResponse)) {
        const balObj = data.DepositEnquiryResponse || data.depositEnquiryResponse;
        if (balObj.errorInfo && balObj.errorInfo.error) {
          let errMsgs = balObj.errorInfo.error;
          if (Array.isArray(errMsgs)) {
             setError(errMsgs.map((e: any) => e.errorMessage).join(", "));
          } else {
             setError(errMsgs.errorMessage || "BillAvenue Error");
          }
        } else {
           // Success case
           setResult(balObj);
        }
      } else {
        setError("Invalid response format from server");
      }
    } catch (err: any) {
      console.error("Check balance error:", err);
      setError(err.message || "Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 tracking-tight">
            Agent Balances
          </h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center">
            <Activity className="w-4 h-4 mr-1.5" />
            Check real-time BillAvenue deposit wallet balance for specific agents
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Search Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Wallet className="w-24 h-24 text-blue-600" />
            </div>
            
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center relative z-10">
              <Search className="w-5 h-5 mr-2 text-blue-500" />
              Enquire Balance
            </h2>
            
            <form onSubmit={checkBalance} className="relative z-10 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Agent ID
                </label>
                <input
                  type="text"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  placeholder="e.g. CC01RS13AGTBBG162607"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono text-sm"
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={loading || !agentId.trim()}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-3 px-4 rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center group"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Check Balance</span>
                    <ChevronRight className="w-4 h-4 ml-1 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2">
          {error && (
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 flex items-start animate-in slide-in-from-bottom-4 fade-in duration-300">
              <AlertCircle className="w-6 h-6 text-rose-500 shrink-0 mr-4 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-rose-800 uppercase tracking-wider mb-1">Enquiry Failed</h3>
                <p className="text-rose-600 text-sm">{error}</p>
              </div>
            </div>
          )}

          {!error && !result && !loading && (
             <div className="bg-slate-50 border border-slate-200/60 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center">
               <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                 <Search className="w-8 h-8 text-slate-300" />
               </div>
               <h3 className="text-slate-600 font-medium">No results yet</h3>
               <p className="text-slate-400 text-sm mt-1">Enter an Agent ID and click check balance to view details.</p>
             </div>
          )}

          {result && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 animate-in slide-in-from-bottom-4 fade-in duration-300">
              <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-100">
                <div className="flex items-center">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mr-4">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Balance Retrieved</h3>
                    <p className="text-sm text-slate-500 font-mono mt-0.5">Institute: {result.instituteId || 'N/A'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Response Code</p>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                    {result.responseCode}
                  </span>
                </div>
              </div>

              {/* Transactions/Entries */}
              <div className="space-y-4">
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Agent Details</h4>
                
                {result.transaction && result.transaction.entry ? (
                  Array.isArray(result.transaction.entry) ? (
                    <div className="grid gap-4">
                      {result.transaction.entry.map((entry: any, idx: number) => (
                        <EntryCard key={idx} entry={entry} />
                      ))}
                    </div>
                  ) : (
                    <EntryCard entry={result.transaction.entry} />
                  )
                ) : (
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-amber-800 text-sm flex items-center">
                     <AlertCircle className="w-4 h-4 mr-2 shrink-0" />
                     No specific agent transaction entry returned in the response.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}

function EntryCard({ entry }: { entry: any }) {
  return (
    <div className="p-5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Agent ID</p>
        <p className="font-mono text-sm font-medium text-slate-800 bg-white px-2 py-1 rounded border border-slate-200 inline-block">
          {entry.agentId || 'Unknown'}
        </p>
      </div>
      <div className="sm:text-right">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Wallet Balance</p>
        <div className="flex items-end sm:justify-end">
          <span className="text-xl font-bold text-slate-800">
            ₹{entry.amount ? Number(entry.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
          </span>
        </div>
      </div>
    </div>
  );
}
