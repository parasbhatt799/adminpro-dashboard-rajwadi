import { 
  Building2, 
  Plus, 
  Trash2, 
  Edit3, 
  Loader2, 
  Upload, 
  CheckCircle2, 
  AlertCircle,
  X,
  CreditCard,
  Search,
  ChevronRight,
  Globe,
  MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect, type ChangeEvent } from 'react';
import { supabase } from '../lib/supabase';

interface Bank {
  id: string;
  bank_name: string;
  logo_url: string | null;
  is_active: boolean;
  show_in_bill_payment: boolean;
  show_in_payout: boolean;
  created_at: string;
}

export default function BankManagement() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    bank_name: '',
    show_in_bill_payment: true,
    show_in_payout: false
  });

  const fetchBanks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bank_details')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBanks(data || []);
    } catch (err) {
      console.error('Error fetching banks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanks();
  }, []);

  const handleLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      let logo_url = editingBank?.logo_url || null;

      if (logoFile) {
        const fileName = `logo_${Date.now()}.${logoFile.name.split('.').pop()}`;
        const { error: uploadError } = await supabase.storage
          .from('bank_logos')
          .upload(fileName, logoFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('bank_logos')
          .getPublicUrl(fileName);

        logo_url = publicUrl;
      }

      const bankData = {
        ...formData,
        logo_url,
      };

      if (editingBank) {
        const { error } = await supabase
          .from('bank_details')
          .update(bankData)
          .eq('id', editingBank.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('bank_details')
          .insert([bankData]);
        if (error) throw error;
      }

      setIsAdding(false);
      setEditingBank(null);
      setLogoFile(null);
      setLogoPreview(null);
      setFormData({
        bank_name: '',
        show_in_bill_payment: true,
        show_in_payout: false
      });
      fetchBanks();
    } catch (err) {
      console.error('Error saving bank:', err);
      setError('Failed to save bank details');
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (bank: Bank) => {
    setEditingBank(bank);
    setFormData({
      bank_name: bank.bank_name,
      show_in_bill_payment: bank.show_in_bill_payment,
      show_in_payout: bank.show_in_payout
    });
    setLogoPreview(bank.logo_url);
    setIsAdding(true);
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    setIsDeleting(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('bank_details')
        .delete()
        .eq('id', showDeleteConfirm);
      if (error) throw error;
      setBanks(prev => prev.filter(b => b.id !== showDeleteConfirm));
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting bank:', err);
      setError('Failed to delete bank');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleStatus = async (bank: Bank) => {
    const newStatus = !bank.is_active;
    setBanks(prev => prev.map(b => b.id === bank.id ? { ...b, is_active: newStatus } : b));

    try {
      const { error } = await supabase
        .from('bank_details')
        .update({ is_active: newStatus })
        .eq('id', bank.id);
      if (error) throw error;
    } catch (err) {
      console.error('Error toggling status:', err);
      fetchBanks();
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Bank Management</h2>
          <p className="text-slate-500 mt-1">Manage bank accounts and payment details for the system.</p>
        </div>
        <button 
          onClick={() => {
            setIsAdding(true);
            setEditingBank(null);
            setFormData({
              bank_name: '',
              show_in_bill_payment: true,
              show_in_payout: false
            });
            setLogoPreview(null);
          }}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95"
        >
          <Plus size={20} />
          <span>Add New Bank</span>
        </button>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl border border-slate-100 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-slate-900">{editingBank ? 'Edit Bank Details' : 'Add New Bank'}</h3>
                <button onClick={() => { setIsAdding(false); setError(null); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
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
                <div className="flex flex-col items-center mb-8">
                  <div className="relative group">
                    <div className="w-24 h-24 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden group-hover:border-indigo-300 transition-colors">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
                      ) : (
                        <Building2 size={32} className="text-slate-300" />
                      )}
                    </div>
                    <label className="absolute -bottom-2 -right-2 p-2 bg-white rounded-xl shadow-lg border border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors">
                      <Upload size={16} className="text-indigo-600" />
                      <input type="file" className="sr-only" accept="image/*" onChange={handleLogoChange} />
                    </label>
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-4">Bank Logo</p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Bank Name</label>
                    <input 
                      required
                      type="text" 
                      value={formData.bank_name}
                      onChange={e => setFormData({...formData, bank_name: e.target.value})}
                      placeholder="e.g. HDFC Bank"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-900">Bill Payment</p>
                        <p className="text-[10px] text-slate-400 font-medium">Show in Bill Pay</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, show_in_bill_payment: !formData.show_in_bill_payment})}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${formData.show_in_bill_payment ? 'bg-indigo-600' : 'bg-slate-300'}`}
                      >
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${formData.show_in_bill_payment ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-900">Payout</p>
                        <p className="text-[10px] text-slate-400 font-medium">Show in Payouts</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, show_in_payout: !formData.show_in_payout})}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${formData.show_in_payout ? 'bg-indigo-600' : 'bg-slate-300'}`}
                      >
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${formData.show_in_payout ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                    </div>
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
                    disabled={uploading}
                    className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                    {editingBank ? 'Update Bank' : 'Save Bank'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
              <h3 className="text-xl font-bold text-slate-900 text-center mb-2">Delete Bank</h3>
              <p className="text-slate-500 text-center mb-8">
                Are you sure you want to delete this bank? This action cannot be undone.
              </p>
              {error && (
                <div className="mb-6 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-bold text-center">
                  {error}
                </div>
              )}
              <div className="flex gap-4">
                <button 
                  onClick={() => { setShowDeleteConfirm(null); setError(null); }}
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

      {/* Banks List */}
      <div className="flex flex-col gap-4">
        {loading ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
            <Loader2 className="animate-spin text-indigo-500" size={40} />
            <p className="font-medium">Loading bank accounts...</p>
          </div>
        ) : banks.length === 0 ? (
          <div className="col-span-full bg-white rounded-3xl border border-slate-100 p-12 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
              <Building2 size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No Banks Added</h3>
            <p className="text-slate-500 max-w-sm mx-auto mb-8">
              You haven't added any bank accounts yet. Add your first bank to start accepting payments.
            </p>
            <button 
              onClick={() => setIsAdding(true)}
              className="text-indigo-600 font-bold hover:underline"
            >
              Add Bank Now
            </button>
          </div>
        ) : (
          banks.map((bank) => (
            <motion.div 
              layout
              key={bank.id}
              className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group hover:shadow-md transition-all ${!bank.is_active ? 'opacity-75' : ''}`}
            >
              <div className="p-4 flex items-center justify-between gap-6">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center overflow-hidden border border-slate-100 shrink-0">
                    {bank.logo_url ? (
                      <img src={bank.logo_url} alt="" className="w-full h-full object-contain p-1.5" />
                    ) : (
                      <Building2 size={20} className="text-slate-300" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-900 truncate">{bank.bank_name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${bank.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${bank.is_active ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {bank.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <div className="flex items-center gap-1.5 ml-2">
                        {bank.show_in_bill_payment && (
                          <span className="text-[9px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded uppercase tracking-tighter">Bill Pay</span>
                        )}
                        {bank.show_in_payout && (
                          <span className="text-[9px] font-bold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded uppercase tracking-tighter">Payout</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <button 
                    onClick={() => toggleStatus(bank)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${bank.is_active ? 'bg-indigo-600' : 'bg-slate-200'}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${bank.is_active ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>

                  <div className="flex items-center gap-1 border-l border-slate-100 pl-4">
                    <button 
                      onClick={() => handleEdit(bank)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button 
                      onClick={() => setShowDeleteConfirm(bank.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
