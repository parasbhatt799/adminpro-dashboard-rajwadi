import { LogoLoader } from './shared/LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Upload, 
  Trash2, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  Eye,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';

export default function AgreementManagement() {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [agreementUrl, setAgreementUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const fetchAgreement = async () => {
    try {
      const { data, error } = await supabase
        .from('qr_settings')
        .select('agreement_pdf_url')
        .eq('id', 1)
        .single();
      
      if (error) throw error;
      setAgreementUrl(data?.agreement_pdf_url || null);
    } catch (err) {
      console.error('Error fetching agreement:', err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchAgreement();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
       setMessage({ type: 'error', text: 'Please upload a PDF file.' });
       return;
    }

    setLoading(true);
    setMessage(null);
    setUploadProgress(0);

    try {
      const fileName = `template_${Math.random().toString(36).substring(7)}.pdf`;
      const filePath = `agreements/${fileName}`;

      // 1. Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      // 2. Update DB
      const { error: dbError } = await supabase
        .from('qr_settings')
        .update({ agreement_pdf_url: publicUrl })
        .eq('id', 1);

      if (dbError) throw dbError;

      setAgreementUrl(publicUrl);
      setMessage({ type: 'success', text: 'Agreement template updated successfully!' });
    } catch (err: any) {
      console.error('Upload Error:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to upload agreement.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to remove the agreement template? Users will not be required to sign anything if removed.')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('qr_settings')
        .update({ agreement_pdf_url: null })
        .eq('id', 1);

      if (error) throw error;
      setAgreementUrl(null);
      setMessage({ type: 'success', text: 'Agreement template removed.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to remove agreement.' });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <LogoLoader size="md" className="mx-auto" />
        <p className="text-slate-500 font-medium">Loading agreement settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">User Agreement Management</h2>
        <p className="text-slate-500 mt-1">Upload the master PDF that users must sign during KYC verification.</p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Current Agreement View */}
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-1">Current Agreement</h3>
            
            {agreementUrl ? (
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 group relative">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                    <FileText size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 truncate">master_agreement.pdf</p>
                    <p className="text-xs text-slate-500 mt-0.5">Active Template</p>
                  </div>
                </div>

                <div className="mt-8 flex items-center gap-3">
                  <a 
                    href={agreementUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 bg-white text-slate-900 px-4 py-2.5 rounded-xl text-sm font-bold border border-slate-200 hover:bg-slate-50 transition-all"
                  >
                    <Eye size={18} />
                    View
                  </a>
                  <button 
                    onClick={handleDelete}
                    disabled={loading}
                    className="p-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-all disabled:opacity-50"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-12 border-2 border-dashed border-slate-200 rounded-3xl text-center">
                <FileText size={40} className="mx-auto text-slate-200 mb-4" />
                <p className="text-slate-500 font-medium">No agreement template uploaded yet.</p>
              </div>
            )}
          </div>

          /* Upload New */
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-1">Update Template</h3>
            
            <label className={`relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-3xl transition-all cursor-pointer group ${
              loading ? 'bg-slate-50 border-slate-200 opacity-50 cursor-wait' : 'bg-indigo-50/10 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/30'
            }`}>
              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <LogoLoader size="md" className="mx-auto" />
                  <p className="text-sm font-bold text-indigo-600">Uploading...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm mb-4 group-hover:scale-110 transition-transform">
                    <Upload size={32} />
                  </div>
                  <p className="text-sm font-bold text-slate-900">Upload New PDF</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
                    Drag and drop or click to select the master agreement PDF
                  </p>
                </div>
              )}
              <input 
                type="file" 
                className="sr-only" 
                accept="application/pdf"
                onChange={handleUpload}
                disabled={loading}
              />
            </label>

            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 text-amber-700">
               <AlertCircle size={18} className="shrink-0 mt-0.5" />
               <p className="text-xs leading-relaxed font-medium">
                 Ensuring that the PDF has empty space at the bottom of the last page for the user's signature.
               </p>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {message && (
             <motion.div
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: 10 }}
               className={`mt-8 p-4 rounded-2xl flex items-center gap-3 border ${
                 message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'
               }`}
             >
               {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
               <p className="text-sm font-bold">{message.text}</p>
             </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
