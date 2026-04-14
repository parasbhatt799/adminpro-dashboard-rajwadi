import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Send, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  User as UserIcon,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { format, parseISO } from 'date-fns';

interface UserComplaintsProps {
  userId: string;
}

export default function UserComplaints({ userId }: UserComplaintsProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ [key: string]: any[] }>({});
  const [loadingMessages, setLoadingMessages] = useState<{ [key: string]: boolean }>({});
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .eq('user_id', userId)
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
      setLoadingMessages(prev => ({ ...prev, [complaintId]: true }));
      const { data, error } = await supabase
        .from('complaint_messages')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(prev => ({ ...prev, [complaintId]: data || [] }));
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoadingMessages(prev => ({ ...prev, [complaintId]: false }));
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent, subject: string, description: string) => {
    e.preventDefault();
    if (!subject || !description) return;

    try {
      setSubmitting(true);
      
      // 1. Create the Complaint Ticket
      const { data: complaint, error: cError } = await supabase
        .from('complaints')
        .insert([{ user_id: userId, subject, status: 'pending' }])
        .select()
        .single();

      if (cError) throw cError;

      // 2. Create the first message
      const { error: mError } = await supabase
        .from('complaint_messages')
        .insert([{ 
          complaint_id: complaint.id, 
          sender_role: 'user', 
          message: description 
        }]);

      if (mError) throw mError;

      setShowForm(false);
      fetchComplaints();
    } catch (err) {
      console.error('Error submitting complaint:', err);
      alert('Failed to submit complaint. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (complaintId: string) => {
    const text = replyText[complaintId];
    if (!text?.trim()) return;

    try {
      const { error } = await supabase
        .from('complaint_messages')
        .insert([{ 
          complaint_id: complaintId, 
          sender_role: 'user', 
          message: text 
        }]);

      if (error) throw error;
      
      setReplyText(prev => ({ ...prev, [complaintId]: '' }));
      fetchMessages(complaintId);
    } catch (err) {
      console.error('Error sending reply:', err);
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      if (!messages[id]) {
        fetchMessages(id);
      }
    }
  };

  if (loading && !complaints.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="animate-spin text-emerald-600" size={48} />
        <p className="text-slate-500 font-medium">Loading your conversations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Support Chat</h2>
          <p className="text-slate-500 mt-1">Talk to our team about any issues or questions.</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
        >
          {showForm ? <MessageSquare size={18} /> : <Plus size={18} />}
          {showForm ? 'View Conversations' : 'New Ticket'}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {showForm ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-2xl mx-auto"
          >
            <NewComplaintForm onSubmit={handleSubmit} submitting={submitting} />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {complaints.length === 0 ? (
              <NoComplaintsView onNew={() => setShowForm(true)} />
            ) : (
              complaints.map((complaint) => (
                <div 
                  key={complaint.id}
                  className={`bg-white rounded-[32px] border transition-all duration-300 overflow-hidden ${
                    expandedId === complaint.id ? 'border-emerald-200 shadow-xl ring-1 ring-emerald-50' : 'border-slate-200 shadow-sm'
                  }`}
                >
                  <div 
                    className="p-6 cursor-pointer flex items-center justify-between gap-4"
                    onClick={() => toggleExpand(complaint.id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                          complaint.status === 'resolved' 
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                            : 'bg-amber-50 text-amber-600 border border-amber-100'
                        }`}>
                          {complaint.status}
                        </span>
                        <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1.5">
                          <Clock size={12} />
                          {format(parseISO(complaint.created_at), 'dd MMM yyyy')}
                        </span>
                      </div>
                      <h4 className="text-lg font-bold text-slate-900 leading-tight">{complaint.subject}</h4>
                    </div>
                    <div className={`p-2 rounded-full transition-colors ${expandedId === complaint.id ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400'}`}>
                      {expandedId === complaint.id ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedId === complaint.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-slate-50/50"
                      >
                        <div className="p-6 pt-2 space-y-6">
                          {/* Chat History */}
                          <div className="space-y-4 max-h-[400px] overflow-y-auto px-2 py-4 no-scrollbar">
                            {loadingMessages[complaint.id] ? (
                              <div className="flex justify-center p-8">
                                <Loader2 className="animate-spin text-emerald-600" size={24} />
                              </div>
                            ) : (
                              messages[complaint.id]?.map((m) => (
                                <div key={m.id} className={`flex ${m.sender_role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${
                                    m.sender_role === 'user' 
                                      ? 'bg-emerald-600 text-white rounded-tr-none' 
                                      : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none'
                                  }`}>
                                    <div className="flex items-center gap-2 mb-1">
                                      {m.sender_role === 'admin' ? <ShieldCheck size={14} className="text-emerald-500" /> : <UserIcon size={14} />}
                                      <span className="text-[10px] uppercase font-black tracking-widest opacity-70">
                                        {m.sender_role === 'user' ? 'You' : 'Admin'}
                                      </span>
                                    </div>
                                    <p className="text-sm font-medium leading-relaxed">{m.message}</p>
                                    <p className={`text-[9px] mt-2 opacity-60 text-right ${m.sender_role === 'user' ? 'text-white' : 'text-slate-400'}`}>
                                      {format(parseISO(m.created_at), 'HH:mm')}
                                    </p>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>

                          {/* Reply Input */}
                          {complaint.status !== 'resolved' ? (
                            <div className="flex gap-3">
                              <input 
                                type="text"
                                value={replyText[complaint.id] || ''}
                                onChange={(e) => setReplyText(prev => ({ ...prev, [complaint.id]: e.target.value }))}
                                placeholder="Type your reply..."
                                onKeyDown={(e) => e.key === 'Enter' && handleReply(complaint.id)}
                                className="flex-1 px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all shadow-sm"
                              />
                              <button 
                                onClick={() => handleReply(complaint.id)}
                                className="p-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-500 transition-all shadow-lg active:scale-95"
                              >
                                <Send size={20} />
                              </button>
                            </div>
                          ) : (
                            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center justify-center gap-3 text-emerald-700 font-bold">
                              <CheckCircle2 size={20} />
                              This conversation is marked as resolved.
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NewComplaintForm({ onSubmit, submitting }: { onSubmit: any, submitting: boolean }) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  return (
    <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
      <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-3">
        <Send className="text-emerald-600" size={24} />
        Start New Conversation
      </h3>
      
      <form onSubmit={(e) => onSubmit(e, subject, description)} className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 ml-1">Subject</label>
          <input 
            type="text" 
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Help with payment"
            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-medium"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 ml-1">Your Problem</label>
          <textarea 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your issue in detail..."
            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-medium min-h-[150px] resize-none"
            required
          />
        </div>

        <button 
          type="submit"
          disabled={submitting}
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-3 disabled:opacity-50 group"
        >
          {submitting ? <Loader2 className="animate-spin" size={20} /> : (
            <>
              Submit Ticket
              <Send size={18} className="group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

function NoComplaintsView({ onNew }: { onNew: any }) {
  return (
    <div className="bg-white p-12 rounded-[40px] border border-dashed border-slate-300 text-center">
      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-4">
        <MessageSquare size={32} />
      </div>
      <h3 className="text-lg font-bold text-slate-900">No support tickets</h3>
      <p className="text-slate-500 mt-2 mb-6">If you have any issues, feel free to start a conversation.</p>
      <button onClick={onNew} className="text-emerald-600 font-black flex items-center gap-2 mx-auto hover:underline uppercase tracking-widest text-xs">
        <Plus size={14} />
        New Ticket
      </button>
    </div>
  );
}
