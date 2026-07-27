import React, { useState, useEffect } from 'react';
import { Wallet, Upload, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';
import { format } from 'date-fns';

export default function B2BAgentFundRequest() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [fetchingRequests, setFetchingRequests] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [agentId, setAgentId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    amount: '',
    utrNumber: '',
    proofUrl: ''
  });
  
  useEffect(() => {
    const id = localStorage.getItem('b2bAgentId');
    if (id) {
      setAgentId(id);
      fetchRequests(id);
    }
  }, []);

  const fetchRequests = async (id: string) => {
    setFetchingRequests(true);
    try {
      const { data, error } = await supabase
        .from('b2b_fund_requests')
        .select('*')
        .eq('agent_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setRequests(data);
    } catch (err) {
      console.error('Error fetching fund requests:', err);
      toast.error('Failed to load request history');
    } finally {
      setFetchingRequests(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB');
      return;
    }

    try {
      setLoading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `b2b-proofs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('b2b_proofs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('b2b_proofs')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, proofUrl: publicUrl }));
      toast.success('Screenshot uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload screenshot');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentId) return;

    if (!formData.amount || !formData.utrNumber || !formData.proofUrl) {
      toast.error('Please fill all fields and upload payment proof');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('b2b_fund_requests')
        .insert({
          agent_id: agentId,
          amount: parseFloat(formData.amount),
          utr_number: formData.utrNumber,
          proof_url: formData.proofUrl,
          status: 'pending'
        });

      if (error) throw error;

      toast.success('Fund request submitted successfully');
      setFormData({ amount: '', utrNumber: '', proofUrl: '' });
      fetchRequests(agentId);
    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error('Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case 'rejected': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <Clock className="h-5 w-5 text-amber-500" />;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Fund Request</h2>
        <p className="text-slate-400">Request wallet top-up by providing transfer details.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Request Form */}
        <div className="lg:col-span-1">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl relative overflow-hidden">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 relative z-10">
              <Wallet className="h-5 w-5 text-indigo-400" />
              New Top-up Request
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.amount}
                  onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter amount"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  UTR / Reference Number
                </label>
                <input
                  type="text"
                  required
                  value={formData.utrNumber}
                  onChange={e => setFormData({ ...formData, utrNumber: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter 12-digit UTR"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Payment Screenshot
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-700 border-dashed rounded-xl bg-slate-900/50 hover:bg-slate-900 transition-colors">
                  <div className="space-y-1 text-center">
                    {formData.proofUrl ? (
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                        <span className="text-sm text-emerald-400 font-medium">Screenshot Uploaded</span>
                        <img src={formData.proofUrl} alt="Proof" className="h-20 w-auto rounded mt-2 opacity-80" />
                        <button type="button" onClick={() => setFormData({ ...formData, proofUrl: '' })} className="text-xs text-red-400 hover:text-red-300 mt-2">
                          Remove
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="mx-auto h-8 w-8 text-slate-400 mb-3" />
                        <div className="flex text-sm text-slate-400 justify-center">
                          <label className="relative cursor-pointer rounded-md font-medium text-indigo-400 hover:text-indigo-300">
                            <span>Upload a file</span>
                            <input
                              type="file"
                              className="sr-only"
                              accept="image/*"
                              onChange={handleFileUpload}
                              disabled={loading}
                            />
                          </label>
                        </div>
                        <p className="text-xs text-slate-500">PNG, JPG up to 2MB</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-indigo-500/10 rounded-xl p-4 border border-indigo-500/20 flex gap-3 mt-4">
                <AlertCircle className="h-5 w-5 text-indigo-400 flex-shrink-0" />
                <p className="text-xs text-indigo-200/70">
                  Requests are usually processed within 15-30 minutes during business hours.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !formData.amount || !formData.utrNumber || !formData.proofUrl}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium py-3 px-4 rounded-xl shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
              >
                {loading ? (
                   <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Processing</span>
                ) : (
                  'Submit Request'
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Request History */}
        <div className="lg:col-span-2">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
            <div className="p-6 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock className="h-5 w-5 text-indigo-400" />
                Request History
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/50 text-slate-400">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Date & Time</th>
                    <th className="px-6 py-4 font-semibold">Amount</th>
                    <th className="px-6 py-4 font-semibold">UTR Number</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {fetchingRequests ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                        Loading requests...
                      </td>
                    </tr>
                  ) : requests.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-400 flex flex-col items-center">
                        <Wallet className="h-8 w-8 mb-2 opacity-50" />
                        No fund requests yet
                      </td>
                    </tr>
                  ) : (
                    requests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-700/20 transition-colors">
                        <td className="px-6 py-4 text-slate-300">
                          {format(new Date(req.created_at), 'dd MMM yyyy, hh:mm a')}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-white">₹{req.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-400 font-mono text-xs bg-slate-900 px-2 py-1 rounded">
                            {req.utr_number}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(req.status)}
                            <span className={`capitalize font-medium ${
                              req.status === 'approved' ? 'text-emerald-400' : 
                              req.status === 'rejected' ? 'text-red-400' : 'text-amber-400'
                            }`}>
                              {req.status}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
