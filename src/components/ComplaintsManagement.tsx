import React, { useState, useEffect } from 'react';
import { 
  Search, 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  ChevronRight,
  Loader2,
  User as UserIcon,
  Send,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  Trash2
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
  
  // Chat State
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const fetchMessages = async (complaintId: string) => {
    try {
      setLoadingMessages(true);
      const { data, error } = await supabase
        .from('complaint_messages')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    fetchComplaints();

    // Subscribe to all complaints changes
    const complaintsChannel = supabase
      .channel('admin_complaints_realtime')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'complaints' 
      }, () => {
        fetchComplaints();
      })
      .subscribe();

    // Subscribe to all messages (for the currently selected thread)
    const messagesChannel = supabase
      .channel('admin_messages_realtime')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'complaint_messages'
      }, (payload) => {
        const newMessage = payload.new;
        if (selectedComplaint?.id === newMessage.complaint_id) {
          fetchMessages(newMessage.complaint_id);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(complaintsChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [selectedComplaint?.id]);

  const handleReply = async (resolve: boolean = false) => {
    if (!replyText.trim() && !resolve) return;

    try {
      setSubmitting(true);
      
      // 1. Send the message if there is text
      if (replyText.trim()) {
        const { error: mError } = await supabase
          .from('complaint_messages')
          .insert([{ 
            complaint_id: selectedComplaint.id, 
            sender_role: 'admin', 
            message: replyText 
          }]);
        if (mError) throw mError;
      }

      // 2. Resolve the ticket if requested
      if (resolve) {
        const { error: cError } = await supabase
          .from('complaints')
          .update({ status: 'resolved', updated_at: new Date().toISOString() })
          .eq('id', selectedComplaint.id);
        if (cError) throw cError;
        
        setSelectedComplaint(prev => ({ ...prev, status: 'resolved' }));
      }

      // 3. Create Notification for the user
      await supabase
        .from('notifications')
        .insert([{
          user_id: selectedComplaint.user_id,
          title: 'Support Ticket Update',
          message: `Admin responded to your ticket: "${selectedComplaint.subject}"`,
          link: '/user/complaints'
        }]);

      setReplyText('');
      fetchMessages(selectedComplaint.id);
      fetchComplaints(); // Refresh list to update status/sorting
    } catch (err) {
      console.error('Error in handleReply:', err);
      alert('Failed to process. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('complaints')
        .delete()
        .eq('id', showDeleteConfirm);

      if (error) throw error;
      
      if (selectedComplaint?.id === showDeleteConfirm) {
        setSelectedComplaint(null);
      }
      setComplaints(prev => prev.filter(c => c.id !== showDeleteConfirm));
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting complaint:', err);
      alert('Failed to delete. Please try again.');
    } finally {
       setIsDeleting(false);
    }
  };

  const openComplaint = (complaint: any) => {
    setSelectedComplaint(complaint);
    fetchMessages(complaint.id);
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

        <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl overflow-hidden flex flex-col min-h-[600px]">
          {/* Ticket Header */}
          <div className="p-8 border-b border-slate-100 bg-slate-50/50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100">
                  <UserIcon size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedComplaint.users_profiles?.name}</h3>
                  <p className="text-sm text-slate-500 font-medium">{selectedComplaint.users_profiles?.firm_name} • {selectedComplaint.users_profiles?.mobile_number}</p>
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
                {selectedComplaint.status === 'resolved' && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(selectedComplaint.id);
                    }}
                    className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                    title="Delete Complaint"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
            </div>
            <h2 className="mt-6 text-2xl font-black text-slate-900 leading-tight">{selectedComplaint.subject}</h2>
          </div>

          {/* Chat area */}
          <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/30 no-scrollbar">
            {loadingMessages ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender_role === 'admin' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-3xl p-5 shadow-sm ${
                    m.sender_role === 'admin' 
                      ? 'bg-indigo-600 text-white rounded-tr-none' 
                      : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                       {m.sender_role === 'admin' ? <ShieldCheck size={14} className="text-indigo-300" /> : <UserIcon size={14} className="text-indigo-500" />}
                      <span className="text-[10px] uppercase font-black tracking-widest opacity-70">
                        {m.sender_role === 'admin' ? 'You' : (selectedComplaint.users_profiles?.name || 'User')}
                      </span>
                    </div>
                    <p className="text-sm font-semibold leading-relaxed whitespace-pre-wrap">{m.message}</p>
                    <p className={`text-[9px] mt-2 opacity-60 text-right ${m.sender_role === 'admin' ? 'text-white' : 'text-slate-400'}`}>
                      {format(parseISO(m.created_at), 'dd MMM, HH:mm')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Actions */}
          <div className="p-8 border-t border-slate-100">
            {selectedComplaint.status !== 'resolved' ? (
              <div className="space-y-4">
                <textarea 
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your response here..."
                  className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-3xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 font-bold min-h-[120px] resize-none"
                />
                <div className="flex flex-col sm:flex-row gap-3">
                  <button 
                    onClick={() => handleReply(false)}
                    disabled={submitting || !replyText.trim()}
                    className="flex-1 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Send size={18} />
                    Send Reply Only
                  </button>
                  <button 
                    onClick={() => handleReply(true)}
                    disabled={submitting}
                    className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                  >
                    <CheckCircle2 size={18} />
                    Resolve & Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 flex items-center justify-center gap-3 text-emerald-700 font-bold">
                <CheckCircle size={20} />
                This ticket has been resolved.
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100"
            >
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto mb-6">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 text-center mb-2">Delete Ticket</h3>
              <p className="text-slate-500 text-center mb-8">
                Are you sure you want to permanently delete this complaint and all its messages? This action cannot be undone.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-rose-200 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                  {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Complaints Management</h2>
          <p className="text-slate-500 mt-1">Review and resolve issues reported by users.</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by subject or user name..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold"
          />
        </div>
        <div className="flex items-center gap-2 p-1.5 bg-slate-50 rounded-2xl border border-slate-100 w-full md:w-auto">
          {(['all', 'pending', 'resolved'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
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
            <p className="text-slate-500 mt-2">Everything looks clean!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredComplaints.map((complaint) => (
              <motion.div 
                key={complaint.id}
                layout
                onClick={() => openComplaint(complaint)}
                className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:border-indigo-200 hover:shadow-xl transition-all cursor-pointer group"
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
                        {format(parseISO(complaint.created_at), 'dd MMM, HH:mm')}
                      </span>
                    </div>
                    <h4 className="text-xl font-black text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">{complaint.subject}</h4>
                    <div className="flex items-center gap-2">
                       <UserIcon size={14} className="text-slate-400" />
                      <span className="text-xs font-bold text-slate-600">{complaint.users_profiles?.name}</span>
                      <span className="text-xs text-slate-300">•</span>
                      <span className="text-xs text-slate-500 font-medium">{complaint.users_profiles?.firm_name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {complaint.status === 'resolved' && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(complaint.id);
                        }}
                        className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"
                        title="Delete Ticket"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                    <div className="p-3 bg-slate-50 text-slate-300 rounded-2xl group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                      <ChevronRight size={20} />
                    </div>
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
