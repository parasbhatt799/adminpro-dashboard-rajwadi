import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Activity, Clock, CheckCircle2, XCircle, FileText, Search, CreditCard } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import Modal from '../../components/Modal';

interface B2BAPIBillHistoryProps {
  isAdmin: boolean;
  agentId?: string; // Passed if isAdmin is false
}

interface LogEntry {
  id: string;
  created_at: string;
  agent_id: string;
  request_body: any;
  response_body: any;
  status_code: number;
}

export default function B2BAPIBillHistory({ isAdmin, agentId }: B2BAPIBillHistoryProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [isAdmin, agentId]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('b2b_api_logs')
        .select('*')
        .eq('endpoint', '/api/b2b/pay-bill')
        .order('created_at', { ascending: false });

      if (!isAdmin && agentId) {
        query = query.eq('agent_id', agentId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching API logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (statusCode: number, responseBody: any) => {
    // If it's a 200, it might still be a business logic failure (e.g., if responseBody.status === 'failed')
    const status = responseBody?.payment_status || (statusCode === 200 ? 'success' : 'failed');
    
    if (status === 'success' && statusCode === 200) {
      return { 
        text: 'Success', 
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      };
    } else if (status === 'pending') {
      return { 
        text: 'Pending', 
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        icon: <Clock className="w-4 h-4 text-amber-400" />
      };
    } else {
      return { 
        text: 'Failed', 
        color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
        icon: <XCircle className="w-4 h-4 text-rose-400" />
      };
    }
  };

  const filteredLogs = logs.filter(log => {
    const searchString = `
      ${log.agent_id} 
      ${log.request_body?.billerId} 
      ${log.request_body?.mobile} 
      ${log.response_body?.transaction_id}
    `.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <Activity className="h-6 w-6 text-indigo-400" />
            API Bill Payments History
          </h2>
          <p className="text-slate-400">View detailed history of all bill payments processed via the B2B API.</p>
        </div>
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search Biller ID, Mobile, Txn ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-72 bg-slate-900 border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder:text-slate-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center bg-slate-800/50 rounded-2xl border border-slate-700/50">
          <LoadingSpinner size="lg" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-12 text-center">
          <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700">
            <CreditCard className="h-8 w-8 text-slate-500" />
          </div>
          <h3 className="text-lg font-medium text-slate-300 mb-1">No API Bill Payments Found</h3>
          <p className="text-slate-500 text-sm">
            {searchTerm ? 'No payments match your search criteria.' : 'There are currently no bill payments made via the API.'}
          </p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-900/50 text-slate-400 border-b border-slate-700/50 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Date & Time</th>
                  {isAdmin && <th className="px-6 py-4">Agent ID</th>}
                  <th className="px-6 py-4">Biller ID</th>
                  <th className="px-6 py-4">Parameters</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Transaction IDs</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filteredLogs.map((log) => {
                  const reqBody = log.request_payload || {};
                  const resBody = log.response_payload || {};
                  const statusInfo = getStatusInfo(log.status_code, resBody);
                  const txnId = resBody?.transaction_id || 'N/A';
                  const bbpsTxnId = resBody?.billPayResponse?.txnRefId || resBody?.ExtBillPayResponse?.txnRefId || resBody?.txnRefId;
                  
                  // Extract the primary customer parameter (like Credit Card number, Consumer Number)
                  const primaryParam = reqBody.customerParams && reqBody.customerParams.length > 0 
                    ? reqBody.customerParams[0].value 
                    : null;
                  
                  return (
                    <tr key={log.id} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-300">{format(parseISO(log.created_at), 'dd MMM, yyyy')}</div>
                        <div className="text-slate-500 text-xs">{format(parseISO(log.created_at), 'hh:mm:ss a')}</div>
                      </td>
                      
                      {isAdmin && (
                        <td className="px-6 py-4">
                          <div className="text-slate-300 font-mono text-xs">{log.agent_id}</div>
                        </td>
                      )}
                      
                      <td className="px-6 py-4">
                        <div className="font-medium text-indigo-400">{reqBody.billerId || 'Unknown Biller'}</div>
                      </td>
                      
                      <td className="px-6 py-4">
                        {primaryParam && (
                          <div className="text-white text-xs font-mono mb-1">{primaryParam}</div>
                        )}
                        <div className="text-slate-400 text-xs">Mobile: {reqBody.mobile || 'N/A'}</div>
                      </td>
                      
                      <td className="px-6 py-4">
                        <div className="font-bold text-white">₹ {Number(reqBody.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                      </td>

                      <td className="px-6 py-4">
                        {txnId !== 'N/A' && (
                          <div className="text-xs font-mono text-slate-400 mb-1" title="API Transaction ID">
                            API: <span className="text-slate-300">{txnId}</span>
                          </div>
                        )}
                        {bbpsTxnId && (
                          <div className="text-xs font-mono text-indigo-400/80" title="BillAvenue Ref ID">
                            BBPS: <span className="text-indigo-300">{bbpsTxnId}</span>
                          </div>
                        )}
                      </td>
                      
                      <td className="px-6 py-4">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${statusInfo.color}`}>
                          {statusInfo.icon}
                          {statusInfo.text}
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" /> View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title="API Bill Payment Details"
          size="4xl" // Large size for detailed JSON viewing
        >
          {(() => {
            const req = selectedLog.request_payload || {};
            const res = selectedLog.response_payload || {};
            const statusInfo = getStatusInfo(selectedLog.status_code, res);
            const bbpsTxnId = res?.billPayResponse?.txnRefId || res?.ExtBillPayResponse?.txnRefId || res?.txnRefId;

            return (
              <div className="space-y-6">
                
                {/* Summary Header */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">Amount</div>
                    <div className="text-lg font-bold text-white">₹ {Number(req.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">Status</div>
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${statusInfo.color}`}>
                      {statusInfo.icon} {statusInfo.text}
                    </div>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">Transaction ID</div>
                    <div className="text-sm font-mono text-slate-300 break-all" title="API Txn ID">{res.transaction_id || 'N/A'}</div>
                    {bbpsTxnId && (
                       <div className="text-xs font-mono text-indigo-400 mt-1" title="BillAvenue Ref ID">BBPS: {bbpsTxnId}</div>
                    )}
                  </div>
                  <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">Date</div>
                    <div className="text-sm text-slate-300">{format(parseISO(selectedLog.created_at), 'dd MMM yyyy, hh:mm:ss a')}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Request Column */}
                  <div className="space-y-4">
                    <h3 className="font-bold text-indigo-400 flex items-center gap-2 border-b border-slate-700 pb-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                      Request Details (Agent -&gt; API)
                    </h3>
                    
                    <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
                       <dl className="space-y-3 text-sm">
                         <div>
                           <dt className="text-slate-500 text-xs uppercase font-bold">Biller ID</dt>
                           <dd className="text-white font-medium">{req.billerId || 'N/A'}</dd>
                         </div>
                         
                         {req.customerParams && req.customerParams.length > 0 && (
                           <div>
                             <dt className="text-slate-500 text-xs uppercase font-bold">Parameters</dt>
                             <dd className="text-white font-medium text-sm mt-1">
                               {req.customerParams.map((p: any, i: number) => (
                                 <div key={i} className="mb-1"><span className="text-slate-400 text-xs">{p.name}:</span> <span className="font-mono">{p.value}</span></div>
                               ))}
                             </dd>
                           </div>
                         )}

                         <div>
                           <dt className="text-slate-500 text-xs uppercase font-bold">Mobile</dt>
                           <dd className="text-white font-medium">{req.mobile || 'N/A'}</dd>
                         </div>
                       </dl>
                       
                       {/* Customer Params */}
                       {req.customerParams && req.customerParams.length > 0 && (
                         <div className="mt-4 pt-4 border-t border-slate-800">
                           <dt className="text-slate-500 text-xs uppercase font-bold mb-2">Customer Parameters</dt>
                           <div className="bg-slate-950 rounded-lg p-3 space-y-2">
                             {req.customerParams.map((param: any, idx: number) => (
                               <div key={idx} className="flex justify-between items-center text-xs">
                                 <span className="text-slate-400">{param.name}:</span>
                                 <span className="text-indigo-300 font-medium">{param.value}</span>
                               </div>
                             ))}
                           </div>
                         </div>
                       )}

                       {/* Biller Response Info (if provided during pay) */}
                       {req.billerResponseInfo && Object.keys(req.billerResponseInfo).length > 0 && (
                         <div className="mt-4 pt-4 border-t border-slate-800">
                           <dt className="text-slate-500 text-xs uppercase font-bold mb-2">Fetched Bill Details (billerResponseInfo)</dt>
                           <div className="bg-slate-950 rounded-lg p-3">
                             <pre className="text-[10px] text-slate-300 overflow-x-auto">
                               {JSON.stringify(req.billerResponseInfo, null, 2)}
                             </pre>
                           </div>
                         </div>
                       )}
                    </div>
                  </div>

                  {/* Response Column */}
                  <div className="space-y-4">
                    <h3 className="font-bold text-emerald-400 flex items-center gap-2 border-b border-slate-700 pb-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      Response Details (API -&gt; Agent)
                    </h3>

                    <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
                      <dl className="space-y-3 text-sm">
                         <div>
                           <dt className="text-slate-500 text-xs uppercase font-bold">HTTP Status Code</dt>
                           <dd className="text-white font-mono">{selectedLog.status_code}</dd>
                         </div>
                         <div>
                           <dt className="text-slate-500 text-xs uppercase font-bold">API Response Code</dt>
                           <dd className="text-amber-400 font-mono font-bold">
                             {res?.data?.responseCode || res?.responseCode || 'N/A'}
                           </dd>
                         </div>
                      </dl>

                      <div className="mt-4 pt-4 border-t border-slate-800">
                        <dt className="text-slate-500 text-xs uppercase font-bold mb-2">Full JSON Response</dt>
                        <div className="bg-slate-950 rounded-lg p-3">
                          <pre className="text-[10px] text-emerald-300 overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(res, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

    </div>
  );
}
