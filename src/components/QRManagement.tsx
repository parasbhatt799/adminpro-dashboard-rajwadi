import { 
  QrCode, 
  Upload, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Image as ImageIcon,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect, type ChangeEvent } from 'react';
import { supabase } from '../lib/supabase';

export default function QRManagement() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [qrData, setQrData] = useState<{ qr_url: string | null; is_enabled: boolean }>({
    qr_url: null,
    is_enabled: true
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchQRSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('qr_settings')
        .select('*')
        .eq('id', 1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        setQrData({
          qr_url: data.qr_url,
          is_enabled: data.is_enabled
        });
      }
    } catch (err) {
      console.error('Error fetching QR settings:', err);
      setError('Failed to load QR settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQRSettings();
  }, []);

  const handleToggle = async () => {
    const newStatus = !qrData.is_enabled;
    setQrData(prev => ({ ...prev, is_enabled: newStatus }));

    try {
      const { error } = await supabase
        .from('qr_settings')
        .update({ is_enabled: newStatus })
        .eq('id', 1);

      if (error) throw error;
    } catch (err) {
      console.error('Error toggling QR status:', err);
      setError('Failed to update status');
      setQrData(prev => ({ ...prev, is_enabled: !newStatus }));
    }
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. List existing files to clean up later
      const { data: existingFiles } = await supabase.storage
        .from('qr_codes')
        .list();

      // 2. Upload new file with a unique name
      const fileExt = file.name.split('.').pop();
      const fileName = `qr_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('qr_codes')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // 3. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('qr_codes')
        .getPublicUrl(fileName);

      // 4. Update Database
      const { error: dbError } = await supabase
        .from('qr_settings')
        .update({ qr_url: publicUrl })
        .eq('id', 1);

      if (dbError) throw dbError;

      // 5. Delete old files from storage to keep only 1
      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map(f => f.name);
        await supabase.storage
          .from('qr_codes')
          .remove(filesToDelete);
      }

      setQrData(prev => ({ ...prev, qr_url: publicUrl }));
      setSuccess('QR Code updated successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error uploading QR:', err);
      setError(err.message || 'Failed to upload QR code');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">QR Code Management</h2>
          <p className="text-slate-500 mt-1">Upload and manage the active payment QR code for your system.</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
          <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${qrData.is_enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
            {qrData.is_enabled ? 'Active' : 'Hidden'}
          </span>
          <button 
            onClick={handleToggle}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none ${qrData.is_enabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
          >
            <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${qrData.is_enabled ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Upload Section */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6">
            <QrCode size={40} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Upload New QR</h3>
          <p className="text-slate-500 text-sm mb-8 leading-relaxed">
            Upload a clear image of your payment QR code. This will replace any existing QR code in the system.
          </p>

          <label className="w-full">
            <div className={`flex items-center justify-center gap-2 w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-100 cursor-pointer active:scale-95 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {uploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
              <span>{uploading ? 'Uploading...' : 'Select & Upload QR'}</span>
            </div>
            <input 
              type="file" 
              className="sr-only" 
              accept="image/*" 
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>

          <AnimatePresence>
            {success && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 flex items-center gap-2 text-emerald-600 text-sm font-bold"
              >
                <CheckCircle2 size={16} />
                {success}
              </motion.div>
            )}
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 flex items-center gap-2 text-rose-600 text-sm font-bold"
              >
                <AlertCircle size={16} />
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Preview Section */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 flex flex-col items-center">
          <div className="flex items-center justify-between w-full mb-6">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Eye size={20} className="text-indigo-600" />
              Live Preview
            </h3>
            <button 
              onClick={fetchQRSettings}
              className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
              title="Refresh Preview"
            >
              <RefreshCw size={18} />
            </button>
          </div>

          <div className="relative w-full aspect-square max-w-[280px] rounded-3xl border-2 border-dashed border-slate-100 flex items-center justify-center overflow-hidden bg-slate-50">
            {!qrData.is_enabled ? (
              <div className="flex flex-col items-center text-slate-400 p-6">
                <EyeOff size={48} className="mb-4 opacity-20" />
                <p className="text-sm font-bold uppercase tracking-widest opacity-50">QR Hidden</p>
                <p className="text-[10px] mt-2">Placeholder shown to users</p>
              </div>
            ) : qrData.qr_url ? (
              <img 
                src={qrData.qr_url} 
                alt="Active QR Code" 
                className="w-full h-full object-contain p-4"
              />
            ) : (
              <div className="flex flex-col items-center text-slate-300">
                <ImageIcon size={48} className="mb-4 opacity-20" />
                <p className="text-xs font-medium">No QR Uploaded</p>
              </div>
            )}
            
            {/* Placeholder Overlay (Simulating what user sees when disabled) */}
            {!qrData.is_enabled && (
              <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-[2px] flex items-center justify-center">
                <div className="bg-white/90 px-4 py-2 rounded-full shadow-sm border border-white">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Placeholder Active</span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 w-full space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest px-2">
              <span>System Status</span>
              <span className={qrData.is_enabled ? 'text-emerald-500' : 'text-rose-500'}>
                {qrData.is_enabled ? 'Visible to Users' : 'Hidden from Users'}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: qrData.is_enabled ? '100%' : '0%' }}
                className={`h-full transition-colors ${qrData.is_enabled ? 'bg-emerald-500' : 'bg-rose-500'}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Usage Info */}
      <div className="bg-indigo-50 rounded-3xl p-6 border border-indigo-100/50">
        <h4 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
          <AlertCircle size={18} />
          Important Note
        </h4>
        <p className="text-sm text-indigo-700 leading-relaxed">
          When you upload a new QR code, it is stored securely in Supabase. The system is configured to only ever keep <strong>one active QR code</strong>. The toggle switch allows you to temporarily hide the QR code from users (e.g., during maintenance) without deleting it.
        </p>
      </div>
    </div>
  );
}
