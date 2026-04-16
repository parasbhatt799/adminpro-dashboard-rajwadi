import { 
  Receipt, 
  Plus, 
  Trash2, 
  Edit3, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  X,
  IndianRupee,
  Percent,
  ArrowRight,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Slab {
  id: string;
  min_amount: number;
  max_amount: number;
  charge_amount: number;
  is_percentage: boolean;
  is_active: boolean;
  created_at: string;
}

interface ServiceChargeManagementProps {
  adminRole?: string;
}

export default function ServiceChargeManagement({ adminRole }: ServiceChargeManagementProps) {
  const isFullAdmin = adminRole === 'full';
  const [slabs, setSlabs] = useState<Slab[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingSlab, setEditingSlab] = useState<Slab | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    min_amount: '',
    max_amount: '',
    charge_amount: '',
    is_percentage: false,
  });

  const fetchSlabs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('service_charge_slabs')
        .select('*')
        .order('min_amount', { ascending: true });

      if (error) throw error;
      setSlabs(data || []);
    } catch (err) {
      console.error('Error fetching slabs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlabs();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const slabData = {
        min_amount: Number(formData.min_amount),
        max_amount: Number(formData.max_amount),
        charge_amount: Number(formData.charge_amount),
        is_percentage: formData.is_percentage,
      };

      if (editingSlab) {
        const { error } = await supabase
          .from('service_charge_slabs')
          .update(slabData)
          .eq('id', editingSlab.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('service_charge_slabs')
          .insert([slabData]);
        if (error) throw error;
      }

      setIsAdding(false);
      setEditingSlab(null);
      setFormData({
        min_amount: '',
        max_amount: '',
        charge_amount: '',
        is_percentage: false,
      });
      fetchSlabs();
    } catch (err) {
      console.error('Error saving slab:', err);
      setError('Failed to save service charge slab');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (slab: Slab) => {
    setEditingSlab(slab);
    setFormData({
      min_amount: slab.min_amount.toString(),
      max_amount: slab.max_amount.toString(),
      charge_amount: slab.charge_amount.toString(),
      is_percentage: slab.is_percentage,
    });
    setIsAdding(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('service_charge_slabs')
        .delete()
        .eq('id', deleteConfirm);
      if (error) throw error;
      setSlabs(prev => prev.filter(s => s.id !== deleteConfirm));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting slab:', err);
      setError('Failed to delete slab');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleStatus = async (slab: Slab) => {
    const newStatus = !slab.is_active;
    setSlabs(prev => prev.map(s => s.id === slab.id ? { ...s, is_active: newStatus } : s));

    try {
      const { error } = await supabase
        .from('service_charge_slabs')
        .update({ is_active: newStatus })
        .eq('id', slab.id);
      if (error) throw error;
    } catch (err) {
      console.error('Error toggling status:', err);
      fetchSlabs();
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Service Charge Slabs</h2>
          <p className="text-slate-500 mt-1">Configure service charge amounts based on transaction value ranges.</p>
        </div>
        {isFullAdmin && (
          <button 
            onClick={() => {
              setIsAdding(true);
              setEditingSlab(null);
              setFormData({
                min_amount: '',
                max_amount: '',
                charge_amount: '',
                is_percentage: false,
              });
              setError(null);
            }}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95"
          >
            <Plus size={20} />
            <span>Add New Slab</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
          <Loader2 className="animate-spin text-indigo-500" size={40} />
          <p className="font-medium">Loading service charge slabs...</p>
        </div>
      ) : slabs.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
            <Receipt size={40} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No Slabs Defined</h3>
          <p className="text-slate-500 max-w-sm mx-auto mb-8">
            You haven't configured any service charge slabs yet. Add your first slab to start calculating charges.
          </p>
          <button 
            onClick={() => setIsAdding(true)}
            className="text-indigo-600 font-bold hover:underline"
          >
            Add Slab Now
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {slabs.map((slab) => (
            <motion.div 
              layout
              key={slab.id}
              className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group hover:shadow-md transition-all ${!slab.is_active ? 'opacity-75' : ''}`}
            >
              <div className="p-4 flex items-center justify-between gap-6">
                <div className="flex items-center gap-6 flex-1">
                  <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
                    <Layers size={24} />
                  </div>
                  
                  <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-12 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">From</p>
                        <p className="text-sm font-bold text-slate-900">₹{slab.min_amount.toLocaleString()}</p>
                      </div>
                      <ArrowRight size={16} className="text-slate-300 mt-4" />
                      <div className="text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">To</p>
                        <p className="text-sm font-bold text-slate-900">₹{slab.max_amount.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="h-8 w-px bg-slate-100 hidden md:block" />

                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Service Charge</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg font-bold text-indigo-600">
                          {slab.is_percentage ? `${slab.charge_amount}%` : `₹${slab.charge_amount.toLocaleString()}`}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                          {slab.is_percentage ? 'Percentage' : 'Flat Fee'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <button 
                    onClick={() => isFullAdmin && toggleStatus(slab)}
                    disabled={!isFullAdmin}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${slab.is_active ? 'bg-indigo-600' : 'bg-slate-200'} ${!isFullAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${slab.is_active ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>

                  {isFullAdmin && (
                    <div className="flex items-center gap-1 border-l border-slate-100 pl-4">
                      <button 
                        onClick={() => handleEdit(slab)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button 
                        onClick={() => setDeleteConfirm(slab.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-slate-900">{editingSlab ? 'Edit Slab' : 'New Service Slab'}</h3>
                <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-sm font-bold">
                    <AlertCircle size={18} />
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Min Amount (₹)</label>
                    <input 
                      required
                      type="number" 
                      value={formData.min_amount}
                      onChange={e => setFormData({...formData, min_amount: e.target.value})}
                      placeholder="0"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Max Amount (₹)</label>
                    <input 
                      required
                      type="number" 
                      value={formData.max_amount}
                      onChange={e => setFormData({...formData, max_amount: e.target.value})}
                      placeholder="1000"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Charge Amount</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      {formData.is_percentage ? <Percent size={16} /> : <IndianRupee size={16} />}
                    </div>
                    <input 
                      required
                      type="number" 
                      step="0.01"
                      value={formData.charge_amount}
                      onChange={e => setFormData({...formData, charge_amount: e.target.value})}
                      placeholder="0.00"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Charge Type</p>
                    <p className="text-xs text-slate-500">Is this a percentage or flat fee?</p>
                  </div>
                  <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, is_percentage: false})}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${!formData.is_percentage ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      Flat
                    </button>
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, is_percentage: true})}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${formData.is_percentage ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      %
                    </button>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                    {editingSlab ? 'Update Slab' : 'Save Slab'}
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
              <h3 className="text-xl font-bold text-slate-900 text-center mb-2">Delete Slab</h3>
              <p className="text-slate-500 text-center mb-8">
                Are you sure you want to delete this service charge slab? This action cannot be undone.
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
