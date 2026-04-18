import { 
  QrCode, 
  Upload, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Image as ImageIcon,
  RefreshCw,
  Eye,
  EyeOff,
  History,
  FileText,
  Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect, type ChangeEvent } from 'react';
import { supabase } from '../lib/supabase';

interface QRHistoryItem {
  id: string;
  qr_name: string;
  qr_url: string;
  is_active: boolean;
  created_at: string;
  whatsapp_number?: string;
  counts?: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
}

export default function QRManagement() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [qrName, setQrName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [qrData, setQrData] = useState<{ qr_url: string | null; is_enabled: boolean; active_qr_id: string | null }>({
    qr_url: null,
    is_enabled: true,
    active_qr_id: null
  });
  const [qrHistory, setQrHistory] = useState<QRHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchQRData = async () => {
    try {
      // 1. Fetch QR Settings
      const { data: settings, error: sError } = await supabase
        .from('qr_settings')
        .select('*')
        .eq('id', 1)
        .single();

      if (sError && sError.code !== 'PGRST116') throw sError;
      
      // 2. Fetch QR History
      const { data: history, error: hError } = await supabase
        .from('qr_history')
        .select('*')
        .order('created_at', { ascending: false });

      if (hError) throw hError;

      // 3. Fetch counts for each history item
      if (history && history.length > 0) {
        const { data: submissions, error: subError } = await supabase
          .from('payment_submissions')
          .select('qr_id, status');

        if (!subError && submissions) {
          history.forEach((item: any) => {
            const itemSubs = submissions.filter(s => s.qr_id === item.id);
            item.counts = {
              total: itemSubs.length,
              pending: itemSubs.filter(s => s.status === 'pending').length,
              approved: itemSubs.filter(s => s.status === 'approved').length,
              rejected: itemSubs.filter(s => s.status === 'rejected').length,
            };
          });
        }
      }

      const activeQR = history?.find(h => h.is_active);

      setQrHistory(history || []);
      setQrData({
        qr_url: settings?.qr_url || activeQR?.qr_url || null,
        is_enabled: settings?.is_enabled ?? true,
        active_qr_id: activeQR?.id || null
      });

    } catch (err) {
      console.error('Error fetching QR data:', err);
      setError('Failed to load QR settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQRData();
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
    if (!qrName.trim()) {
      setError('Please provide a name for this QR code first.');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. Upload new file with a unique name
      const fileExt = file.name.split('.').pop();
      const fileName = `qr_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('qr_codes')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('qr_codes')
        .getPublicUrl(fileName);

      // 3. Set all previous QRs to inactive
      await supabase
        .from('qr_history')
        .update({ is_active: false })
        .eq('is_active', true);

      // 4. Create History Entry
      const { data: newQR, error: hError } = await supabase
        .from('qr_history')
        .insert({
          qr_name: qrName.trim(),
          whatsapp_number: whatsappNumber.trim(),
          qr_url: publicUrl,
          is_active: true
        })
        .select()
        .single();

      if (hError) throw hError;

      // 5. Update Legacy Settings
      const { error: dbError } = await supabase
        .from('qr_settings')
        .update({ qr_url: publicUrl })
        .eq('id', 1);

      if (dbError) throw dbError;

      setQrName('');
      setWhatsappNumber('');
      await fetchQRData();
      setSuccess('New QR Code activated and tracking started!');
      
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
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">QR Code Management</h2>
          <p className="text-slate-500 mt-1">Upload and track multiple QR codes for your system.</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
          <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${qrData.is_enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
            {qrData.is_enabled ? 'Visible' : 'Hidden'}
          </span>
          <button 
            onClick={handleToggle}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none ${qrData.is_enabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
          >
            <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${qrData.is_enabled ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Section */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6">
            <Upload size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Upload New QR</h3>
          <p className="text-slate-500 text-sm mb-6 leading-relaxed">
            Enter a unique name for this QR code (e.g. PhonePe_01) to track its entries.
          </p>

          <div className="w-full space-y-4">
            <div className="relative">
              <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="QR Name (e.g. PhonePe_01)" 
                value={qrName}
                onChange={(e) => setQrName(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold text-sm"
              />
            </div>

            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="tel" 
                placeholder="WhatsApp Number (e.g. 919876543210)" 
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, ''))}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold text-sm"
              />
            </div>

            <label className="w-full block">
              <div className={`flex items-center justify-center gap-2 w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-100 cursor-pointer active:scale-95 ${uploading || !qrName.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {uploading ? <Loader2 className="animate-spin" size={20} /> : <QrCode size={20} />}
                <span>{uploading ? 'Processing...' : 'Select & Update QR'}</span>
              </div>
              <input 
                type="file" 
                className="sr-only" 
                accept="image/*" 
                onChange={handleUpload}
                disabled={uploading || !qrName.trim()}
              />
            </label>
          </div>

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
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Eye size={20} className="text-indigo-600" />
                Current Active QR
              </h3>
              <p className="text-xs text-slate-400 mt-1">This QR is currently being shown to users.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${qrData.is_enabled ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                {qrData.is_enabled ? 'Live Now' : 'Currently Hidden'}
              </span>
              <button 
                onClick={fetchQRData}
                className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                title="Refresh"
              >
                <RefreshCw size={18} />
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-8 items-center">
            <div className="relative w-64 h-64 shrink-0 rounded-3xl border-2 border-dashed border-slate-100 flex items-center justify-center overflow-hidden bg-slate-50">
              {qrData.qr_url ? (
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
            </div>

            <div className="flex-1 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Active QR Name</p>
                  <p className="text-lg font-bold text-slate-900">{qrHistory.find(h => h.is_active)?.qr_name || 'N/A'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">WhatsApp Target</p>
                  <p className="text-sm font-bold text-slate-900 truncate">{qrHistory.find(h => h.is_active)?.whatsapp_number || 'NOT SET'}</p>
                </div>
                <div className="bg-emerald-50/30 p-4 rounded-2xl border border-emerald-100 col-span-2">
                  <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Total Entries</p>
                  <p className="text-lg font-bold text-emerald-700">{qrHistory.find(h => h.is_active)?.counts?.total || 0}</p>
                </div>
              </div>

              <div className="p-4 bg-indigo-50/30 rounded-2xl border border-indigo-100">
                <h4 className="text-xs font-bold text-indigo-900 mb-3 uppercase tracking-widest">Entry Status Breakdown</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <p className="text-sm font-bold text-amber-600">{qrHistory.find(h => h.is_active)?.counts?.pending || 0}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Pending</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-emerald-600">{qrHistory.find(h => h.is_active)?.counts?.approved || 0}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Approved</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-rose-600">{qrHistory.find(h => h.is_active)?.counts?.rejected || 0}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Rejected</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* History Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-2">
          <History size={20} className="text-indigo-600" />
          <h3 className="text-lg font-bold text-slate-900">QR Tracking History</h3>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">QR Name / Date</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">WhatsApp</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Total Entries</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Breakdown (P / A / R)</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {qrHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic text-sm">
                      No QR history available. Upload your first QR to start tracking.
                    </td>
                  </tr>
                ) : (
                  qrHistory.map((item) => (
                    <tr key={item.id} className={`${item.is_active ? 'bg-indigo-50/20' : 'hover:bg-slate-50/50'} transition-colors`}>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900">{item.qr_name}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                            {new Date(item.created_at).toLocaleDateString()} at {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-xs font-bold text-slate-600">{item.whatsapp_number || '-'}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${item.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                          {item.is_active ? 'Active' : 'Archived'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-bold text-slate-700">{item.counts?.total || 0}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-amber-500">{item.counts?.pending || 0}</span>
                          <span className="text-slate-200">/</span>
                          <span className="text-xs font-bold text-emerald-500">{item.counts?.approved || 0}</span>
                          <span className="text-slate-200">/</span>
                          <span className="text-xs font-bold text-rose-500">{item.counts?.rejected || 0}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => window.open(item.qr_url, '_blank')}
                          className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                          title="View QR Source"
                        >
                          <ImageIcon size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Usage Info */}
      <div className="bg-indigo-50 rounded-3xl p-6 border border-indigo-100/50">
        <h4 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
          <AlertCircle size={18} />
          Tracking Logic
        </h4>
        <p className="text-sm text-indigo-700 leading-relaxed">
          Every QR you upload is tracked by its unique <strong>ID</strong>. When users submit payments, they are automatically linked to the QR that was <strong>Active</strong> at the time of submission. Toggling visibility "Off" does not change the tracking; new entries will still count towards the same QR ID until a new one is uploaded to replace it.
        </p>
      </div>
    </div>
  );
}
