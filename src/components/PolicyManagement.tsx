import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Plus, 
  Trash2, 
  RotateCcw, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  AlertCircle,
  Clock,
  BookOpen,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';

interface Policy {
  id: string;
  title: string;
  content: string;
  is_active: boolean;
  created_at: string;
}

export default function PolicyManagement() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchPolicies = async () => {
    try {
      const { data, error } = await supabase
        .from('app_policies')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPolicies(data || []);
    } catch (err) {
      console.error('Error fetching policies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleAddPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('app_policies')
        .insert([{ 
          title: newTitle.trim(), 
          content: newContent.trim(), 
          is_active: true 
        }]);
      if (error) throw error;
      setNewTitle('');
      setNewContent('');
      fetchPolicies();
    } catch (err) {
      console.error('Error adding policy:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('app_policies')
        .update({ is_active: !currentStatus })
        .eq('id', id);
      if (error) throw error;
      fetchPolicies();
    } catch (err) {
      console.error('Error toggling status:', err);
    }
  };

  const deletePolicy = async () => {
    if (!showDeleteConfirm) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('app_policies')
        .delete()
        .eq('id', showDeleteConfirm);
      if (error) throw error;
      setPolicies(prev => prev.filter(p => p.id !== showDeleteConfirm));
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting policy:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Rules & Policy Management</h2>
        <p className="text-slate-500 mt-1">Manage terms, conditions, and operational policies for users.</p>
      </div>

      {/* Add New Policy */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <form onSubmit={handleAddPolicy} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Policy Title</label>
              <input 
                type="text" 
                placeholder="e.g. Withdrawal Rules, KYC Terms..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Policy Content</label>
              <textarea 
                placeholder="Enter policy details here..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button 
              type="submit"
              disabled={submitting || !newTitle.trim() || !newContent.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-8 py-3 rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 transition-all flex items-center gap-2"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
              Add Policy
            </button>
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
              <h3 className="text-xl font-bold text-slate-900 text-center mb-2">Delete Policy</h3>
              <p className="text-slate-500 text-center mb-8">
                Are you sure you want to delete this policy? This action cannot be undone.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={deletePolicy}
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
            <Shield size={14} />
            Active Policies
          </h3>
          <button onClick={fetchPolicies} className="p-1.5 hover:bg-white rounded-lg text-slate-400 transition-all">
            <RotateCcw size={14} />
          </button>
        </div>

        <div className="divide-y divide-slate-50">
          {loading ? (
            <div className="p-12 text-center text-indigo-600 font-bold flex flex-col items-center gap-2">
              <Loader2 className="animate-spin" size={32} />
              <span className="text-xs uppercase tracking-widest">Loading Policies...</span>
            </div>
          ) : policies.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <AlertCircle className="mx-auto mb-3 opacity-20" size={48} />
              <p className="text-sm font-medium">No policies created yet.</p>
              <p className="text-xs mt-1">Add a policy above to show it to users.</p>
            </div>
          ) : (
            policies.map((policy) => (
              <motion.div 
                layout
                key={policy.id}
                className="p-6 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className={`text-lg font-bold ${policy.is_active ? 'text-slate-900' : 'text-slate-400'}`}>
                        {policy.title}
                      </h4>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        policy.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {policy.is_active ? 'Visible' : 'Hidden'}
                      </span>
                    </div>
                    <p className={`text-sm leading-relaxed whitespace-pre-wrap ${policy.is_active ? 'text-slate-600' : 'text-slate-300 italic'}`}>
                      {policy.content}
                    </p>
                    <div className="flex items-center gap-4 mt-4">
                      <p className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock size={10} />
                        Updated {new Date(policy.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => toggleStatus(policy.id, policy.is_active)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      title={policy.is_active ? 'Hide' : 'Show'}
                    >
                      {policy.is_active ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
                    </button>
                    <button 
                      onClick={() => setShowDeleteConfirm(policy.id)}
                      className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
