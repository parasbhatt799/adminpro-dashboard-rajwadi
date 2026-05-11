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
  Image as ImageIcon,
  GripVertical
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { supabase } from '../lib/supabase';

interface QRMasterItem {
  id: string;
  qr_name: string;
  mobile_number: string;
  qr_image_url: string;
  bg_color?: string;
  display_order: number;
  created_at: string;
  is_active: boolean;
}

const COLOR_OPTIONS = [
  { name: 'Default', value: 'white', class: 'bg-white border-slate-200' },
  { name: 'Pink', value: 'pink', class: 'bg-pink-50 border-pink-200 text-pink-700' },
  { name: 'Green', value: 'green', class: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  { name: 'Indigo', value: 'indigo', class: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
  { name: 'Yellow', value: 'yellow', class: 'bg-amber-50 border-amber-200 text-amber-700' },
];

const COLOR_PRIORITY: Record<string, number> = {
  pink: 1,
  indigo: 2,
  green: 3,
  yellow: 4,
  white: 5
};

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
  const [bgColor, setBgColor] = useState('white');
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchQRList = async () => {
    try {
      const { data, error } = await supabase
        .from('qr_master')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      
      // Secondary sort in JS to ensure strict color priority
      const sorted = (data || []).sort((a, b) => {
        const pA = COLOR_PRIORITY[a.bg_color || 'white'] || 5;
        const pB = COLOR_PRIORITY[b.bg_color || 'white'] || 5;
        if (pA !== pB) return pA - pB;
        return a.display_order - b.display_order;
      });

      setQrList(sorted);
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
    setBgColor('white');
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
        const { error: dbError } = await supabase
          .from('qr_master')
          .update({
            qr_name: qrName.trim(),
            mobile_number: mobileNumber.trim(),
            qr_image_url: finalImageUrl,
            bg_color: bgColor
          })
          .eq('id', editingId);

        if (dbError) throw dbError;
        setSuccess('QR entry updated successfully!');
      } else {
        // Get max display order for the new item
        const maxOrder = qrList.length > 0 ? Math.max(...qrList.map(i => i.display_order)) : 0;
        
        const { error: dbError } = await supabase
          .from('qr_master')
          .insert({
            qr_name: qrName.trim(),
            mobile_number: mobileNumber.trim(),
            qr_image_url: finalImageUrl,
            bg_color: bgColor,
            display_order: maxOrder + 1
          });

        if (dbError) throw dbError;
        setSuccess('New QR entry saved!');
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

  const toggleActive = async (item: QRMasterItem) => {
    try {
      const { error } = await supabase
        .from('qr_master')
        .update({ is_active: !item.is_active })
        .eq('id', item.id);

      if (error) throw error;
      
      // Update local state for immediate feedback
      setQrList(prev => prev.map(q => 
        q.id === item.id ? { ...q, is_active: !item.is_active } : q
      ));
      
      setSuccess(`${item.qr_name} is now ${!item.is_active ? 'Active' : 'Inactive'}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error toggling active state:', err);
      setError('Failed to update status');
    }
  };

  const handleEdit = (item: QRMasterItem) => {
    setEditingId(item.id);
    setQrName(item.qr_name);
    setMobileNumber(item.mobile_number || '');
    setImagePreview(item.qr_image_url);
    setImageFile(null);
    setBgColor(item.bg_color || 'white');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReorder = async (newOrder: QRMasterItem[]) => {
    // Sort the new order by color priority to maintain grouping
    const strictOrder = [...newOrder].sort((a, b) => {
      const pA = COLOR_PRIORITY[a.bg_color || 'white'] || 5;
      const pB = COLOR_PRIORITY[b.bg_color || 'white'] || 5;
      if (pA !== pB) return pA - pB;
      return 0; // Maintain relative order within group
    });

    setQrList(newOrder);

    try {
      const updates = newOrder.map((item, index) => ({
        id: item.id,
        display_order: index + 1
      }));

      const { error } = await supabase
        .from('qr_master')
        .upsert(updates, { onConflict: 'id' });

      if (error) throw error;
    } catch (err) {
      console.error('Error saving new order:', err);
    }
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

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Container Color</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBgColor(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${bgColor === opt.value ? opt.class + ' ring-2 ring-indigo-500 ring-offset-1' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-300'}`}
                  >
                    {opt.name}
                  </button>
                ))}
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

        {/* List Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search by name or mobile..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
              />
            </div>
            {qrList.length > 0 && searchQuery === '' && (
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 border-l border-slate-100 hidden md:block">
                Drag to Reorder
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4">
            {loading ? (
              <div className="py-12 flex flex-col items-center gap-3">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
                <p className="text-sm text-slate-500 font-medium">Loading your entries...</p>
              </div>
            ) : filteredList.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                  <QrCode size={32} />
                </div>
                <p className="text-slate-500 font-medium">{searchQuery ? 'No results found' : 'No entries yet. Add your first one!'}</p>
              </div>
            ) : (
              <Reorder.Group 
                axis="y" 
                values={qrList} 
                onReorder={handleReorder}
                className="space-y-4"
              >
                {qrList
                  .filter(item => 
                    item.qr_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    item.mobile_number.includes(searchQuery)
                  )
                  .map((item) => {
                    const colorOpt = COLOR_OPTIONS.find(o => o.value === item.bg_color) || COLOR_OPTIONS[0];
                    return (
                      <Reorder.Item 
                        key={item.id} 
                        value={item}
                        className={`p-5 rounded-3xl border shadow-sm transition-all flex gap-4 items-center cursor-grab active:cursor-grabbing ${colorOpt.class}`}
                        whileDrag={{ scale: 1.02, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
                      >
                        <div className="text-slate-300 opacity-50 group-hover:opacity-100 transition-opacity">
                          <GripVertical size={20} />
                        </div>
                        <div className="w-20 h-20 bg-white rounded-2xl border border-slate-100 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                          {item.qr_image_url ? (
                            <img src={item.qr_image_url} alt={item.qr_name} className="w-full h-full object-contain p-2" />
                          ) : (
                            <ImageIcon className="text-slate-200" size={24} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-slate-900 truncate uppercase">{item.qr_name}</h4>
                            <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter ${
                              item.is_active 
                                ? 'bg-emerald-100 text-emerald-700' 
                                : 'bg-slate-200 text-slate-500'
                            }`}>
                              {item.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <p className="text-sm opacity-70 flex items-center gap-1.5 mt-1">
                            <Phone size={14} />
                            {item.mobile_number || 'No Mobile'}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-3 pr-2 border-r border-slate-200 mr-2">
                             <button
                                type="button"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={() => toggleActive(item)}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none ${
                                  item.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                                }`}
                              >
                                <span
                                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                    item.is_active ? 'translate-x-5' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                          </div>
                          <button 
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => handleEdit(item)}
                            className="p-2 hover:bg-black/5 rounded-xl transition-all"
                            title="Edit"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => handleDelete(item.id)}
                            className="p-2 hover:bg-black/5 rounded-xl transition-all"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </Reorder.Item>
                    );
                  })
                }
              </Reorder.Group>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
