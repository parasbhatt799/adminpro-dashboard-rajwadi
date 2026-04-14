import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  ChevronRight,
  Loader2,
  User as UserIcon,
  Send,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { format, parseISO } from 'date-fns';

export default function ComplaintsManagement() {
  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('complaints')
        .select(`
          *,
          users_profiles (
            name,
            firm_name,
            mobile_number,
            profile_photo_url
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComplaints(data || []);
    } catch (err) {
      console.error('Error fetching complaints:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText || !selectedComplaint) return;

    try {
      setSubmittingReply(true);
      const { error } = await supabase
        .from('complaints')
        .update({
          admin_reply: replyText,
          status: 'resolved',
          replied_at: new Date().toISOString()
        })
        .eq('id', selectedComplaint.id);

      if (error) throw error;

      setReplyText('');
      setSelectedComplaint(null);
      fetchComplaints();
    } catch (err) {
      console.error('Error submitting reply:', err);
      alert('Failed to send reply. Please try again.');
    } finally {
      setSubmittingReply(false);
    }
  };

  const filteredComplaints = complaints.filter(c => {
    const matchesFilter = filter === 'all' || c.status === filter;
    const matchesSearch = 
      c.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.users_profiles?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (selectedComplaint) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="max-w-4xl mx-auto space-y-6"
      >
        <button 
          onClick={() => setSelectedComplaint(null)}
          className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold transition-colors group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          Back to List
        </button>

        <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-100 bg-slate-50/30">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                  <UserIcon size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedComplaint.users_profiles?.name}</h3>
                  <p className="text-sm text-slate-500 font-medium">{selectedComplaint.users_profiles?.firm_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${
                  selectedComplaint.status === 'resolved' 
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                    : 'bg-amber-50 text-amber-600 border border-amber-100'
                }`}>
                  {selectedComplaint.status}
                </span>
                <span className="text-[11px] text-slate-400 font-bold">
                  {format(parseISO(selectedComplaint.created_at), 'dd MMM yyyy, HH:mm')}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-2xl font-black text-slate-900 leading-tight">{selectedComplaint.subject}</h4>
              <div className="p-6 bg-white rounded-2xl border border-slate-100 text-slate-600 leading-relaxed font-medium">
                {selectedComplaint.description}
              </div>
            </div>
          </div>

          <div className="p-8 space-y-6">
            <h5 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <MessageSquare size={16} />
              Your Response
            </h5>

            {selectedComplaint.admin_reply && (
              <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 mb-6">
                <p className="text-emerald-800 font-bold leading-relaxed">{selectedComplaint.admin_reply}</p>
                <p className="text-[10px] text-emerald-400 font-bold mt-2">
                  Replied on {format(parseISO(selectedComplaint.replied_at), 'dd MMM yyyy, HH:mm')}
                </p>
              </div>
            )}

            <form onSubmit={handleReply} className="space-y-4">
              <textarea 
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={selectedComplaint.admin_reply ? "Update your reply..." : "Type your solution here..."}
                className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 font-bold min-h-[150px] resize-none"
                required
              />
              <button 
                type="submit"
                disabled={submittingReply}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-500 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-lg shadow-indigo-600/20"
              >
                {submittingReply ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <Send size={18} />
                    {selectedComplaint.admin_reply ? 'Update Response' : 'Send Response & Resolve'}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Complaints Management</h2>
          <p className="text-slate-500 mt-1">Review and resolve issues reported by users.</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by subject or user name..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
          />
        </div>
        <div className="flex items-center gap-2 p-1 bg-slate-50 rounded-2xl border border-slate-100 w-full md:w-auto">
          {(['all', 'pending', 'resolved'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                filter === t 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <Loader2 className="animate-spin text-indigo-600" size={48} />
            <p className="text-slate-500 font-medium">Loading complaints...</p>
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div className="bg-white p-16 rounded-[40px] border border-dashed border-slate-300 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-4">
              <MessageSquare size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No complaints found</h3>
            {searchQuery || filter !== 'all' ? (
              <p className="text-slate-500 mt-2">Try adjusting your filters or search query.</p>
            ) : (
              <p className="text-slate-500 mt-2">Everything looks quiet for now!</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredComplaints.map((complaint) => (
              <motion.div 
                key={complaint.id}
                layout
                onClick={() => setSelectedComplaint(complaint)}
                className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                        complaint.status === 'resolved' 
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                          : 'bg-amber-50 text-amber-600 border border-amber-100'
                      }`}>
                        {complaint.status}
                      </span>
                      <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1.5">
                        <Clock size={12} />
                        {format(parseISO(complaint.created_at), 'dd MMM HH:mm')}
                      </span>
                    </div>
                    <h4 className="text-xl font-black text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">{complaint.subject}</h4>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden">
                        {complaint.users_profiles?.profile_photo_url ? (
                          <img src={complaint.users_profiles.profile_photo_url} className="w-full h-full object-cover" />
                        ) : (
                          <UserIcon size={12} />
                        )}
                      </div>
                      <span className="text-xs font-bold text-slate-600">{complaint.users_profiles?.name}</span>
                      <span className="text-xs text-slate-300">•</span>
                      <span className="text-xs text-slate-500 font-medium">{complaint.users_profiles?.firm_name}</span>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 text-slate-300 rounded-2xl group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                    <ChevronRight size={20} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
