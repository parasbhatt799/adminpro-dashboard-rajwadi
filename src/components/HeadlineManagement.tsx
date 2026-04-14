import React, { useState, useEffect } from 'react';
import { 
  Megaphone, 
  Plus, 
  Trash2, 
  RotateCcw, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  AlertCircle,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';

interface Headline {
  id: string;
  message: string;
  is_active: boolean;
  created_at: string;
}

export default function HeadlineManagement() {
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newMessage, setNewMessage] = useState('');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchHeadlines = async () => {
    try {
      const { data, error } = await supabase
        .from('headlines')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setHeadlines(data || []);
    } catch (err) {
      console.error('Error fetching headlines:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeadlines();
  }, []);

  const handleAddHeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('headlines')
        .insert([{ message: newMessage, is_active: true }]);
      if (error) throw error;
      setNewMessage('');
      fetchHeadlines();
    } catch (err) {
      console.error('Error adding headline:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('headlines')
        .update({ is_active: !currentStatus })
        .eq('id', id);
      if (error) throw error;
      fetchHeadlines();
    } catch (err) {
      console.error('Error toggling status:', err);
    }
  };

  const deleteHeadline = async () => {
    if (!showDeleteConfirm) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('headlines')
        .delete()
        .eq('id', showDeleteConfirm);
      if (error) throw error;
      setHeadlines(prev => prev.filter(h => h.id !== showDeleteConfirm));
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting headline:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Headline Management</h2>
        <p className="text-slate-500 mt-1">Manage scrolling marquee messages for the user dashboard.</p>
      </div>

      {/* Add New Headline */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <form onSubmit={handleAddHeadline} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">New Headline Message</label>
            <div className="flex gap-4">
              <input 
                type="text" 
                placeholder="Type your marquee message here..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-400"
              />
              <button 
                type="submit"
                disabled={submitting || !newMessage.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 whitespace-nowrap"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                Add Headline
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100"
            >
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto mb-6">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 text-center mb-2">Delete Headline</h3>
              <p className="text-slate-500 text-center mb-8">
                Are you sure you want to delete this headline? This action cannot be undone.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={deleteHeadline}
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

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Megaphone size={14} />
            Active Headlines
          </h3>
          <button onClick={fetchHeadlines} className="p-1.5 hover:bg-white rounded-lg text-slate-400 transition-all">
            <RotateCcw size={14} />
          </button>
        </div>

        <div className="divide-y divide-slate-50">
          {loading ? (
            <div className="p-12 text-center text-indigo-600 font-bold flex flex-col items-center gap-2">
              <Loader2 className="animate-spin" size={32} />
              <span className="text-xs uppercase tracking-widest">Loading Headlines...</span>
            </div>
          ) : headlines.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <AlertCircle className="mx-auto mb-3 opacity-20" size={48} />
              <p className="text-sm font-medium">No headlines created yet.</p>
              <p className="text-xs mt-1">Add a message above to show it on user dashboard.</p>
            </div>
          ) : (
            headlines.map((headline) => (
              <motion.div 
                layout
                key={headline.id}
                className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors group"
              >
                <div className="flex-1 pr-8">
                  <p className={`text-sm font-medium ${headline.is_active ? 'text-slate-700' : 'text-slate-400 italic font-normal'}`}>
                    {headline.message}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                    <Clock size={10} />
                    Added on {new Date(headline.created_at).toLocaleDateString()} at {new Date(headline.created_at).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => toggleStatus(headline.id, headline.is_active)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                      headline.is_active 
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100' 
                        : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {headline.is_active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    {headline.is_active ? 'Active' : 'Inactive'}
                  </button>
                  <button 
                    onClick={() => setShowDeleteConfirm(headline.id)}
                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
