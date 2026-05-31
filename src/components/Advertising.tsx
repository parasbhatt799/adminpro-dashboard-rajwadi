import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { LogoLoader } from './shared/LoadingSpinner';
import { useToast } from '../context/ToastContext';
import { 
  Image as ImageIcon, 
  Link as LinkIcon, 
  Save, 
  UploadCloud, 
  Globe, 
  AlertCircle, 
  RefreshCw, 
  ExternalLink 
} from 'lucide-react';
import { motion } from 'motion/react';

export default function Advertising() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bannerUrl, setBannerUrl] = useState('');
  const [redirectLink, setRedirectLink] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');

  // Fetch current advertising settings
  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('advertising')
        .select('*')
        .eq('id', 1)
        .single();

      if (error) {
        console.error('Error fetching advertising settings:', error);
        toast.error('Failed to load advertising settings');
      } else if (data) {
        setBannerUrl(data.banner_url || '');
        setRedirectLink(data.redirect_link || '');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    return () => {
      // Clean up the preview URL object on unmount
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, []);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, JPEG, WEBP)');
      return;
    }

    // Validate size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setSelectedFile(file);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
  };

  // Submit / Save settings
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      let finalBannerUrl = bannerUrl;

      // 1. Upload file if a new one is selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `system_banner_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('site_assets')
          .upload(fileName, selectedFile, { cacheControl: '3600', upsert: true });

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        const { data } = supabase.storage.from('site_assets').getPublicUrl(fileName);
        finalBannerUrl = data.publicUrl;
      }

      // 2. Save settings to DB
      const { error: updateError } = await supabase
        .from('advertising')
        .update({
          banner_url: finalBannerUrl,
          redirect_link: redirectLink || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);

      if (updateError) {
        throw updateError;
      }

      setBannerUrl(finalBannerUrl);
      setSelectedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl('');
      }
      toast.success('Advertising settings updated successfully!');
    } catch (err: any) {
      console.error('Error saving advertising settings:', err);
      toast.error(err.message || 'Failed to save advertising settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-indigo-600 font-bold flex flex-col items-center gap-2">
        <LogoLoader size="md" className="mx-auto" />
        <span className="text-xs uppercase tracking-widest">Loading Settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Advertising Settings</h2>
        <p className="text-slate-500 mt-1">Manage the advertisement banner shown on the user/distributor login page.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left/Middle Column - Settings Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <form onSubmit={handleSave} className="space-y-6">
              {/* Image Upload Input Area */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1.5">
                  <ImageIcon size={12} /> Banner Image
                </label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-indigo-500 rounded-2xl p-8 text-center cursor-pointer transition-all bg-slate-50 hover:bg-slate-50/50 flex flex-col items-center justify-center gap-3 group"
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden" 
                    accept="image/*"
                  />
                  <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:shadow-md transition-all">
                    <UploadCloud size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700">
                      {selectedFile ? 'Change Selected Banner' : 'Upload Banner Image'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Drag and drop, or click to browse. Max size 5MB. Recommended ratio (6:10 or 16:9 vertical).
                    </p>
                  </div>
                  {selectedFile && (
                    <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-semibold">
                      {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  )}
                </div>
              </div>

              {/* Redirect Link Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1.5">
                  <LinkIcon size={12} /> Redirect Link (URL) - Optional
                </label>
                <div className="relative">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="url" 
                    placeholder="https://example.com/promo-landing"
                    value={redirectLink}
                    onChange={(e) => setRedirectLink(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-400 text-slate-800 font-medium"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-3.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 flex-1"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  {saving ? 'Saving changes...' : 'Save Settings'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    if (previewUrl) {
                      URL.revokeObjectURL(previewUrl);
                      setPreviewUrl('');
                    }
                    fetchSettings();
                  }}
                  disabled={saving}
                  className="border border-slate-200 hover:bg-slate-50 text-slate-500 px-6 py-3.5 rounded-xl text-sm font-bold transition-all"
                >
                  Reset
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column - Live Preview */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col h-full min-h-[400px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <ImageIcon size={14} /> Live Preview
              </h3>
              {redirectLink && (
                <a 
                  href={redirectLink} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-500 flex items-center gap-1.5 transition-colors"
                >
                  Test Link <ExternalLink size={12} />
                </a>
              )}
            </div>

            <div className="flex-1 relative rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center min-h-[300px]">
              {(previewUrl || bannerUrl) ? (
                <img 
                  src={previewUrl || bannerUrl} 
                  alt="Advertisement Banner" 
                  className="w-full h-full object-cover absolute inset-0"
                />
              ) : (
                <div className="text-center text-slate-400 p-6">
                  <AlertCircle className="mx-auto mb-2 opacity-30" size={32} />
                  <p className="text-xs font-semibold">No Banner Loaded</p>
                  <p className="text-[10px] mt-1">Upload a banner to see preview here.</p>
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-50">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Target Action</p>
              <p className="text-xs text-slate-600 truncate font-mono bg-slate-50 p-2 rounded-lg border border-slate-100">
                {redirectLink || 'No URL configured'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple loader helper inside file since Loader2 is used
const Loader2 = ({ size, className }: { size: number; className?: string }) => (
  <svg 
    className={`animate-spin ${className}`} 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24"
    style={{ width: size, height: size }}
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);
