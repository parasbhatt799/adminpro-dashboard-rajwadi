import React, { useState, useEffect, type ChangeEvent } from 'react';
import { 
  QrCode, 
  Plus, 
  Trash2, 
  Edit2, 
  Upload, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Phone,
  FileText,
  Search,
  X,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';

interface QRMasterItem {
  id: string;
  qr_name: string;
  mobile_number: string;
  qr_image_url: string;
  created_at: string;
}

export default function QRMasterManagement() {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [qrList, setQrList] = useState<QRMasterItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [qrName, setQrName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchQRList = async () => {
    try {
      const { data, error } = await supabase
        .from('qr_master')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQrList(data || []);
    } catch (err) {
      console.error('Error fetching QR Master list:', err);
      setError('Failed to load QR list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQRList();
  }, []);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setQrName('');
    setMobileNumber('');
    setImageFile(null);
    setImagePreview(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrName.trim()) {
      setError('Please provide a QR name');
      return;
    }

    setProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      let finalImageUrl = imagePreview;

      // 1. Upload Image if new file selected
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `master_qr_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('qr_codes')
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('qr_codes')
          .getPublicUrl(fileName);
        
        finalImageUrl = publicUrl;
      }

      if (editingId) {
        // Update Existing
        const { error: dbError } = await supabase
          .from('qr_master')
          .update({
            qr_name: qrName.trim(),
            mobile_number: mobileNumber.trim(),
            qr_image_url: finalImageUrl
          })
          .eq('id', editingId);

        if (dbError) throw dbError;
        setSuccess('QR entry updated successfully!');
      } else {
        // Create New
        const { error: dbError } = await supabase
          .from('qr_master')
          .insert({
            qr_name: qrName.trim(),
            mobile_number: mobileNumber.trim(),
            qr_image_url: finalImageUrl
          });

        if (dbError) throw dbError;
        setSuccess('New QR entry saved to master list!');
      }

      resetForm();
      fetchQRList();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error saving QR Master entry:', err);
      setError(err.message || 'Failed to save QR entry');
    } finally {
      setProcessing(false);
    }
  };

  const handleEdit = (item: QRMasterItem) => {
    setEditingId(item.id);
    setQrName(item.qr_name);
    setMobileNumber(item.mobile_number || '');
    setImagePreview(item.qr_image_url);
    setImageFile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this QR from master list?')) return;

    try {
      const { error } = await supabase
        .from('qr_master')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchQRList();
    } catch (err) {
      console.error('Error deleting QR:', err);
      setError('Failed to delete QR');
    }
  };

  const filteredList = qrList.filter(item => 
    item.qr_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.mobile_number?.includes(searchQuery)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">QR Name Entry (Master)</h2>
          <p className="text-slate-500 mt-1">Pre-define QR codes to use in the Upload QR page.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Entry Form */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 h-fit sticky top-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              {editingId ? <Edit2 size={20} /> : <Plus size={20} />}
            </div>
            <h3 className="text-lg font-bold text-slate-900">{editingId ? 'Edit QR Entry' : 'Add New Entry'}</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">QR Name</label>
              <div className="relative">
                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="e.g. PhonePe_Main" 
                  value={qrName}
                  onChange={(e) => setQrName(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Mobile Number</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="tel" 
                  placeholder="e.g. 919876543210" 
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">QR Image</label>
              <div className="relative">
                <div className="aspect-square w-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center overflow-hidden relative group">
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-contain p-4" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                         <label className="cursor-pointer bg-white text-slate-900 px-4 py-2 rounded-xl text-xs font-bold shadow-lg">
                           Change Image
                           <input type="file" className="sr-only" accept="image/*" onChange={handleImageChange} />
                         </label>
                      </div>
                    </>
                  ) : (
                    <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
                      <ImageIcon className="text-slate-300 mb-2" size={32} />
                      <span className="text-xs font-bold text-slate-400 uppercase">Upload Image</span>
                      <input type="file" className="sr-only" accept="image/*" onChange={handleImageChange} />
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
                >
                  <X size={18} />
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={processing}
                className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-95"
              >
                {processing ? <Loader2 className="animate-spin" size={20} /> : <QrCode size={20} />}
                <span>{editingId ? 'Update Entry' : 'Save Entry'}</span>
              </button>
            </div>

            <AnimatePresence>
              {success && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-emerald-600 text-xs font-bold justify-center">
                  <CheckCircle2 size={14} /> {success}
                </motion.div>
              )}
              {error && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-rose-600 text-xs font-bold justify-center">
                  <AlertCircle size={14} /> {error}
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </div>

        {/* Master List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by name or mobile..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredList.length === 0 ? (
              <div className="col-span-full bg-white rounded-3xl border border-slate-200 p-20 text-center space-y-4">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mx-auto">
                  <QrCode size={40} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-900">No QR Entries Found</h4>
                  <p className="text-slate-500 text-sm">Add your first QR to the master list to see it here.</p>
                </div>
              </div>
            ) : (
              filteredList.map((item) => (
                <motion.div 
                  key={item.id} 
                  layout
                  className="bg-white rounded-3xl border border-slate-200 p-5 flex gap-4 items-center group hover:border-indigo-200 transition-all shadow-sm"
                >
                  <div className="w-20 h-20 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                    {item.qr_image_url ? (
                      <img src={item.qr_image_url} alt={item.qr_name} className="w-full h-full object-contain p-2" />
                    ) : (
                      <ImageIcon className="text-slate-200" size={24} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-900 truncate">{item.qr_name}</h4>
                    <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-1">
                      <Phone size={14} className="text-slate-400" />
                      {item.mobile_number || 'No Mobile'}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => handleEdit(item)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                      title="Edit"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
