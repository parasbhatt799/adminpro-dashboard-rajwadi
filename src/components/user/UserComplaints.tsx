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
  Plus
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

  // Form State
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

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

  useEffect(() => {
    fetchComplaints();
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !description) return;

    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('complaints')
        .insert([
          {
            user_id: userId,
            subject,
            description,
            status: 'pending'
          }
        ]);

      if (error) throw error;

      setSubject('');
      setDescription('');
      setShowForm(false);
      fetchComplaints();
    } catch (err) {
      console.error('Error submitting complaint:', err);
      alert('Failed to submit complaint. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading && !complaints.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="animate-spin text-emerald-600" size={48} />
        <p className="text-slate-500 font-medium">Loading your complaints...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Support & Complaints</h2>
          <p className="text-slate-500 mt-1">Have an issue? report it here and our team will help you.</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
        >
          {showForm ? <MessageSquare size={18} /> : <Plus size={18} />}
          {showForm ? 'View Complaints' : 'New Complaint'}
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
            <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                <Send className="text-emerald-600" size={24} />
                Submit New Complaint
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Subject</label>
                  <input 
                    type="text" 
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Payment not reflected in wallet"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-medium"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Description</label>
                  <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your issue in detail..."
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-medium min-h-[150px] resize-none"
                    required
                  />
                </div>

                <div className="pt-2">
                  <button 
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    {submitting ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <>
                        Submit Complaint
                        <Send size={18} className="group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {complaints.length === 0 ? (
              <div className="bg-white p-12 rounded-[32px] border border-dashed border-slate-300 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-4">
                  <MessageSquare size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">No complaints yet</h3>
                <p className="text-slate-500 mt-2">Any complaints you submit will appear here.</p>
              </div>
            ) : (
              complaints.map((complaint) => (
                <motion.div 
                  key={complaint.id}
                  layout
                  className={`bg-white rounded-3xl border transition-all duration-300 ${
                    expandedId === complaint.id ? 'border-emerald-200 shadow-md ring-1 ring-emerald-50' : 'border-slate-200 shadow-sm'
                  }`}
                >
                  <div 
                    className="p-6 cursor-pointer flex items-start justify-between gap-4"
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
                          {format(parseISO(complaint.created_at), 'dd MMM yyyy, HH:mm')}
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
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-6 pt-2 space-y-6">
                          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Your Complaint</p>
                            <p className="text-slate-600 leading-relaxed font-medium">{complaint.description}</p>
                          </div>

                          {complaint.admin_reply ? (
                            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-100/50 rounded-full -mr-8 -mt-8"></div>
                              <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <CheckCircle2 size={14} />
                                Admin Response
                                {complaint.replied_at && (
                                  <span className="text-emerald-400 ml-auto lowercase">
                                    {format(parseISO(complaint.replied_at), 'dd MMM HH:mm')}
                                  </span>
                                )}
                              </p>
                              <p className="text-emerald-800 leading-relaxed font-bold">{complaint.admin_reply}</p>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 p-6 bg-slate-50 rounded-2xl text-slate-500 border border-dashed border-slate-200">
                              <AlertCircle size={20} className="text-amber-500 shrink-0" />
                              <p className="text-sm font-medium">Waiting for admin reply...</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
