import { 
  Settings as SettingsIcon, 
  MessageSquare, 
  Save, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Key, 
  Hash, 
  Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [whatsappSettings, setWhatsappSettings] = useState({
    is_active: false,
    access_token: '',
    phone_number_id: '',
    sender_number: ''
  });

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_api_settings')
        .select('*')
        .eq('id', 1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        setWhatsappSettings({
          is_active: data.is_active || false,
          access_token: data.access_token || '',
          phone_number_id: data.phone_number_id || '',
          sender_number: data.sender_number || ''
        });
      }
    } catch (err: any) {
      console.error('Error fetching settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase
        .from('whatsapp_api_settings')
        .upsert({
          id: 1,
          ...whatsappSettings,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
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
      <div>
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <SettingsIcon className="text-indigo-600" size={28} />
          Business Settings
        </h2>
        <p className="text-slate-500 mt-1">Manage global system configurations and API integrations.</p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* WhatsApp Business API Section */}
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                <MessageSquare size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">WhatsApp Business API</h3>
                <p className="text-xs text-slate-500">Configure Meta Cloud API for automated notifications.</p>
              </div>
            </div>
            
            <button 
              onClick={() => setWhatsappSettings(prev => ({ ...prev, is_active: !prev.is_active }))}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${whatsappSettings.is_active ? 'bg-emerald-500' : 'bg-slate-200'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${whatsappSettings.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Phone Number ID</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text"
                    placeholder="e.g. 1092837465..."
                    value={whatsappSettings.phone_number_id}
                    onChange={(e) => setWhatsappSettings(prev => ({ ...prev, phone_number_id: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Sender Mobile Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text"
                    placeholder="e.g. 919876543210"
                    value={whatsappSettings.sender_number}
                    onChange={(e) => setWhatsappSettings(prev => ({ ...prev, sender_number: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">System Access Token (Meta API)</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <textarea 
                    rows={3}
                    placeholder="Enter your Meta Cloud API permanent access token..."
                    value={whatsappSettings.access_token}
                    onChange={(e) => setWhatsappSettings(prev => ({ ...prev, access_token: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100/50 flex gap-3">
              <AlertCircle className="text-amber-600 shrink-0" size={18} />
              <div className="text-xs text-amber-800 leading-relaxed">
                <p className="font-bold mb-1">Important Note:</p>
                When **WhatsApp API Status** is ON, the system will automatically send payment proof screenshots to the WhatsApp number associated with the QR code upon approval. Ensure your Meta App is correctly configured with these credentials to avoid failures.
              </div>
            </div>
          </div>
        </section>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-100">
          <AnimatePresence>
            {success && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-emerald-600 text-sm font-bold"
              >
                <CheckCircle2 size={18} />
                {success}
              </motion.div>
            )}
            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-rose-600 text-sm font-bold"
              >
                <AlertCircle size={18} />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 ml-auto active:scale-95"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
