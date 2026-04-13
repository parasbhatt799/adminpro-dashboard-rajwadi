import { 
  FileQuestion, 
  Plus, 
  Trash2, 
  Edit3, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  FolderPlus,
  MessageSquare,
  MoreVertical,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Category {
  id: string;
  name: string;
  show_in_bill: boolean;
  show_in_qr: boolean;
  show_in_kyc: boolean;
  created_at: string;
}

interface Reason {
  id: string;
  category_id: string;
  reason_text: string;
  is_active: boolean;
  created_at: string;
}

export default function ReasonManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  
  // Modals
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isAddingReason, setIsAddingReason] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [editingReason, setEditingReason] = useState<Reason | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Form States
  const [categoryName, setCategoryName] = useState('');
  const [showInBill, setShowInBill] = useState(false);
  const [showInQr, setShowInQr] = useState(false);
  const [showInKyc, setShowInKyc] = useState(false);
  const [reasonText, setReasonText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'category' | 'reason'; id: string; name?: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catRes, reasonRes] = await Promise.all([
        supabase.from('rejection_categories').select('*').order('name'),
        supabase.from('rejection_reasons').select('*').order('created_at', { ascending: false })
      ]);

      if (catRes.error) throw catRes.error;
      if (reasonRes.error) throw reasonRes.error;

      setCategories(catRes.data || []);
      setReasons(reasonRes.data || []);
      
      // Expand all by default if first load
      if (expandedCategories.length === 0 && catRes.data) {
        setExpandedCategories(catRes.data.map(c => c.id));
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const categoryData = { 
        name: categoryName,
        show_in_bill: showInBill,
        show_in_qr: showInQr,
        show_in_kyc: showInKyc
      };

      if (editingCategory) {
        const { error } = await supabase
          .from('rejection_categories')
          .update(categoryData)
          .eq('id', editingCategory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('rejection_categories')
          .insert([categoryData]);
        if (error) throw error;
      }
      setCategoryName('');
      setShowInBill(false);
      setShowInQr(false);
      setShowInKyc(false);
      setIsAddingCategory(false);
      setEditingCategory(null);
      setError(null);
      fetchData();
    } catch (err) {
      console.error('Error saving category:', err);
      setError('Failed to save category. Name might already exist.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddReason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryId) return;
    setSaving(true);
    try {
      if (editingReason) {
        const { error } = await supabase
          .from('rejection_reasons')
          .update({ reason_text: reasonText })
          .eq('id', editingReason.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('rejection_reasons')
          .insert([{ 
            category_id: selectedCategoryId, 
            reason_text: reasonText 
          }]);
        if (error) throw error;
      }
      setReasonText('');
      setIsAddingReason(false);
      setEditingReason(null);
      setError(null);
      fetchData();
    } catch (err) {
      console.error('Error saving reason:', err);
      setError('Failed to save reason.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    setError(null);
    try {
      const table = deleteConfirm.type === 'category' ? 'rejection_categories' : 'rejection_reasons';
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', deleteConfirm.id);
      if (error) throw error;
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      console.error('Error deleting:', err);
      setError(`Failed to delete ${deleteConfirm.type}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleReasonStatus = async (reason: Reason) => {
    const newStatus = !reason.is_active;
    setReasons(prev => prev.map(r => r.id === reason.id ? { ...r, is_active: newStatus } : r));
    try {
      const { error } = await supabase
        .from('rejection_reasons')
        .update({ is_active: newStatus })
        .eq('id', reason.id);
      if (error) throw error;
    } catch (err) {
      console.error('Error toggling status:', err);
      fetchData();
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Reason Entry Management</h2>
          <p className="text-slate-500 mt-1">Configure rejection reasons categorized for better organization.</p>
        </div>
        <div className="flex gap-3">
            <button 
              onClick={() => {
                setEditingCategory(null);
                setCategoryName('');
                setShowInBill(false);
                setShowInQr(false);
                setShowInKyc(false);
                setIsAddingCategory(true);
              }}
              className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-3 rounded-xl font-bold transition-all hover:bg-slate-50 active:scale-95"
            >
              <FolderPlus size={20} className="text-indigo-600" />
              <span>New Category</span>
            </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
          <Loader2 className="animate-spin text-indigo-500" size={40} />
          <p className="font-medium">Loading reasons and categories...</p>
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
            <FileQuestion size={40} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No Categories Yet</h3>
          <p className="text-slate-500 max-w-sm mx-auto mb-8">
            Create your first category to start adding rejection reasons.
          </p>
          <button 
            onClick={() => setIsAddingCategory(true)}
            className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100"
          >
            Create Category
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map((category) => {
            const categoryReasons = reasons.filter(r => r.category_id === category.id);
            const isExpanded = expandedCategories.includes(category.id);

            return (
              <div key={category.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Category Header */}
                <div 
                  className={`p-6 flex items-center justify-between cursor-pointer transition-colors ${isExpanded ? 'bg-slate-50/50' : 'hover:bg-slate-50/30'}`}
                  onClick={() => toggleCategory(category.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                      <Filter size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{category.name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                          {categoryReasons.length} {categoryReasons.length === 1 ? 'Reason' : 'Reasons'}
                        </p>
                        <div className="h-3 w-px bg-slate-200" />
                        <div className="flex gap-2">
                          {category.show_in_bill && <span className="text-[9px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded font-bold uppercase">Bill</span>}
                          {category.show_in_qr && <span className="text-[9px] px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded font-bold uppercase">QR</span>}
                          {category.show_in_kyc && <span className="text-[9px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded font-bold uppercase">KYC</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                    <button 
                      onClick={() => {
                        setSelectedCategoryId(category.id);
                        setEditingReason(null);
                        setReasonText('');
                        setIsAddingReason(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors"
                    >
                      <Plus size={14} />
                      Add Reason
                    </button>
                    <div className="h-8 w-px bg-slate-200 mx-1" />
                    <button 
                      onClick={() => {
                        setEditingCategory(category);
                        setCategoryName(category.name);
                        setShowInBill(category.show_in_bill);
                        setShowInQr(category.show_in_qr);
                        setShowInKyc(category.show_in_kyc);
                        setIsAddingCategory(true);
                      }}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                    >
                      <Edit3 size={18} />
                    </button>
                    <button 
                      onClick={() => setDeleteConfirm({ type: 'category', id: category.id, name: category.name })}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                    <div className="ml-2 text-slate-300">
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                </div>

                {/* Reasons List */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-slate-50"
                    >
                      <div className="p-6 space-y-3">
                        {categoryReasons.length === 0 ? (
                          <div className="py-8 text-center text-slate-400 text-sm italic">
                            No reasons added to this category yet.
                          </div>
                        ) : (
                          categoryReasons.map((reason) => (
                            <div 
                              key={reason.id}
                              className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${reason.is_active ? 'bg-white border-slate-100' : 'bg-slate-50/50 border-transparent opacity-60'}`}
                            >
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${reason.is_active ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-400'}`}>
                                  <MessageSquare size={16} />
                                </div>
                                <p className={`text-sm font-medium truncate ${reason.is_active ? 'text-slate-700' : 'text-slate-500'}`}>
                                  {reason.reason_text}
                                </p>
                              </div>
                              <div className="flex items-center gap-4 ml-4">
                                <button 
                                  onClick={() => toggleReasonStatus(reason)}
                                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${reason.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                >
                                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${reason.is_active ? 'translate-x-5' : 'translate-x-1'}`} />
                                </button>
                                <div className="flex items-center gap-1 border-l border-slate-100 pl-4">
                                  <button 
                                    onClick={() => {
                                      setEditingReason(reason);
                                      setReasonText(reason.reason_text);
                                      setSelectedCategoryId(category.id);
                                      setIsAddingReason(true);
                                    }}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                  >
                                    <Edit3 size={16} />
                                  </button>
                                  <button 
                                    onClick={() => setDeleteConfirm({ type: 'reason', id: reason.id })}
                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Category Modal */}
      <AnimatePresence>
        {isAddingCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">{editingCategory ? 'Edit Category' : 'New Category'}</h3>
                <button onClick={() => setIsAddingCategory(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleAddCategory} className="space-y-6">
                {error && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-sm font-bold">
                    <AlertCircle size={18} />
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Category Name</label>
                  <input 
                    required
                    autoFocus
                    type="text" 
                    value={categoryName}
                    onChange={e => setCategoryName(e.target.value)}
                    placeholder="e.g. Identity Verification"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Show in Pages</label>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setShowInBill(!showInBill)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${showInBill ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                    >
                      <span className="text-sm font-bold">Bill Payment Page</span>
                      <div className={`w-10 h-5 rounded-full relative transition-colors ${showInBill ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${showInBill ? 'left-6' : 'left-1'}`} />
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowInQr(!showInQr)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${showInQr ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                    >
                      <span className="text-sm font-bold">QR Payment Page</span>
                      <div className={`w-10 h-5 rounded-full relative transition-colors ${showInQr ? 'bg-emerald-600' : 'bg-slate-300'}`}>
                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${showInQr ? 'left-6' : 'left-1'}`} />
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowInKyc(!showInKyc)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${showInKyc ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                    >
                      <span className="text-sm font-bold">KYC / Verification Page</span>
                      <div className={`w-10 h-5 rounded-full relative transition-colors ${showInKyc ? 'bg-amber-600' : 'bg-slate-300'}`}>
                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${showInKyc ? 'left-6' : 'left-1'}`} />
                      </div>
                    </button>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsAddingCategory(false)}
                    className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                    {editingCategory ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reason Modal */}
      <AnimatePresence>
        {isAddingReason && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{editingReason ? 'Edit Reason' : 'Add Reason'}</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                    Category: {categories.find(c => c.id === selectedCategoryId)?.name}
                  </p>
                </div>
                <button onClick={() => setIsAddingReason(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleAddReason} className="space-y-6">
                {error && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-sm font-bold">
                    <AlertCircle size={18} />
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Reason Text</label>
                  <textarea 
                    required
                    autoFocus
                    rows={3}
                    value={reasonText}
                    onChange={e => setReasonText(e.target.value)}
                    placeholder="Enter the rejection reason clearly..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
                  />
                </div>

                <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsAddingReason(false)}
                    className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                    {editingReason ? 'Update' : 'Save Reason'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
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
              <h3 className="text-xl font-bold text-slate-900 text-center mb-2">
                Delete {deleteConfirm.type === 'category' ? 'Category' : 'Reason'}
              </h3>
              <p className="text-slate-500 text-center mb-8">
                {deleteConfirm.type === 'category' 
                  ? `Are you sure you want to delete "${deleteConfirm.name}"? This will also delete all reasons inside it.`
                  : 'Are you sure you want to delete this rejection reason?'} This action cannot be undone.
              </p>
              {error && (
                <div className="mb-6 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-bold text-center">
                  {error}
                </div>
              )}
              <div className="flex gap-4">
                <button 
                  onClick={() => { setDeleteConfirm(null); setError(null); }}
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
    </div>
  );
}
