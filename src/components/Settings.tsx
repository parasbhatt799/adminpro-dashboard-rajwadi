import { 
  Settings as SettingsIcon, 
  MessageSquare, 
  Save, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Key, 
  Hash, 
  Phone,
  Bell,
  BellRing,
  Smartphone
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

  const [oneSignalSettings, setOneSignalSettings] = useState({
    is_enabled: false,
    app_id: '',
    rest_api_key: ''
  });

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  const fetchSettings = async () => {
    try {
      // 1. WhatsApp Settings
      const { data: waData, error: waError } = await supabase
        .from('whatsapp_api_settings')
        .select('*')
        .eq('id', 1)
        .single();

      if (waError && waError.code !== 'PGRST116') throw waError;
      if (waData) {
        setWhatsappSettings({
          is_active: waData.is_active || false,
          access_token: waData.access_token || '',
          phone_number_id: waData.phone_number_id || '',
          sender_number: waData.sender_number || ''
        });
      }

      // 2. OneSignal Settings
      const { data: osData, error: osError } = await supabase
        .from('onesignal_settings')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (osError && osError.code !== 'PGRST116') throw osError;
      if (osData) {
        setOneSignalSettings({
          is_enabled: osData.is_enabled || false,
          app_id: osData.app_id || '',
          rest_api_key: osData.rest_api_key || ''
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

    // Check OneSignal Subscription Status & Player ID
    const checkStatus = async () => {
      try {
        const OneSignal = (window as any).OneSignal;
        if (OneSignal) {
          const pushEnabled = await OneSignal.Notifications.permission;
          setIsSubscribed(pushEnabled === 'granted');
          
          const user = await OneSignal.User;
          if (user?.PushSubscription?.id) {
            setPlayerId(user.PushSubscription.id);
          }
        }
      } catch (err) {
        console.error('Error checking OneSignal status:', err);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. Save WhatsApp Settings
      const { error: waError } = await supabase
        .from('whatsapp_api_settings')
        .upsert({
          id: 1,
          ...whatsappSettings,
          updated_at: new Date().toISOString()
        });

      if (waError) throw waError;

      // 2. Save OneSignal Settings
      const { error: osError } = await supabase
        .from('onesignal_settings')
        .upsert({
          id: 1,
          ...oneSignalSettings,
          updated_at: new Date().toISOString()
        });

      if (osError) throw osError;

      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSubscribe = async () => {
    try {
      const OneSignal = (window as any).OneSignal;
      if (!OneSignal) {
        setError('OneSignal SDK not loaded. Please ensure you have a stable internet connection and refresh.');
        return;
      }

      // v16 API uses .Notifications, but we should check if it's initialized
      if (OneSignal.Notifications) {
        console.log('Opening subscription prompt (v16)...');
        await OneSignal.Notifications.requestPermission();
      } else if (typeof OneSignal.showNativePrompt === 'function') {
        // Fallback for older versions or transitional states
        console.log('Opening subscription prompt (Legacy)...');
        await OneSignal.showNativePrompt();
      } else {
        setError('OneSignal is still initializing. Please wait a moment and try again.');
        console.warn('OneSignal Notifications namespace not found yet:', OneSignal);
      }
    } catch (err: any) {
      console.error('Subscription error:', err);
      setError(err.message || 'Failed to open subscription prompt');
    }
  };

  const handleTestNotification = async () => {
    if (!oneSignalSettings.app_id || !oneSignalSettings.rest_api_key) {
      setError('Please save both App ID and REST API Key before testing.');
      return;
    }

    setTestLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/send-push-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test Notification 🔔',
          message: 'If you see this, your Push Notifications are working correctly!',
          credentials: {
            app_id: oneSignalSettings.app_id,
            rest_api_key: oneSignalSettings.rest_api_key
          }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send test');

      setSuccess('Test notification triggered! Check your mobile.');
    } catch (err: any) {
      console.error('Test Error:', err);
      setError('Test failed: ' + err.message);
    } finally {
      setTestLoading(false);
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

        {/* OneSignal Section */}
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                <Bell size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Push Notifications (OneSignal)</h3>
                <p className="text-xs text-slate-500">Enable real-time mobile push alerts for new requests.</p>
              </div>
            </div>
            
            <button 
              onClick={() => setOneSignalSettings(prev => ({ ...prev, is_enabled: !prev.is_enabled }))}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${oneSignalSettings.is_enabled ? 'bg-indigo-500' : 'bg-slate-200'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${oneSignalSettings.is_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">OneSignal App ID</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text"
                    placeholder="e.g. 550e8400-e29b-41d4-a716..."
                    value={oneSignalSettings.app_id}
                    onChange={(e) => setOneSignalSettings(prev => ({ ...prev, app_id: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">REST API Key</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="password"
                    placeholder="Enter your REST API key..."
                    value={oneSignalSettings.rest_api_key}
                    onChange={(e) => setOneSignalSettings(prev => ({ ...prev, rest_api_key: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="md:col-span-2 flex items-center justify-between p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSubscribed ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                    <BellRing size={20} />
                  </div>
                  <div>
                    <p className={`font-bold ${isSubscribed ? 'text-emerald-900' : 'text-amber-900'}`}>
                      {isSubscribed ? 'Device Subscribed' : 'Device Not Subscribed'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {isSubscribed 
                        ? `Your Unique Player ID: ${playerId || 'Detecting...'}` 
                        : 'Run this on your mobile to receive alerts.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSubscribe}
                  disabled={isSubscribed}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                    isSubscribed 
                      ? 'bg-emerald-50 text-emerald-600 cursor-default' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md active:scale-95'
                  }`}
                >
                  {isSubscribed ? 'Subscribed ✓' : 'Subscribe Now'}
                </button>
              </div>

              <div className="md:col-span-2 flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-400 border border-slate-100 shadow-sm">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Push Delivery Test</p>
                    <p className="text-xs text-slate-500">Send a test alert to all subscribed admins.</p>
                  </div>
                </div>
                <button
                  onClick={handleTestNotification}
                  disabled={testLoading}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm"
                >
                  {testLoading ? <Loader2 className="animate-spin" size={16} /> : <Bell size={16} />}
                  Send Test Alert
                </button>
              </div>
            </div>

            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100/50 flex gap-3">
              <AlertCircle className="text-amber-600 shrink-0" size={18} />
              <div className="text-xs text-amber-800 leading-relaxed">
                <p className="font-bold mb-1">How it works:</p>
                1. Save your OneSignal credentials above. <br/>
                2. Click **"Subscribe Now"** on your mobile phone browser. <br/>
                3. The system will now send a push notification to your phone whenever a user submits a QR Payment, Bill, or KYC request.
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
