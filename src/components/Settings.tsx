import { 
  Send,
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
  Smartphone,
  Upload,
  Image as ImageIcon,
  Volume2,
  Music,
  Receipt,
  RefreshCw
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
    provider: 'meta',
    access_token: '',
    phone_number_id: '',
    sender_number: '',
    aisensy_api_key: '',
    aisensy_campaign_name: ''
  });

  const [oneSignalSettings, setOneSignalSettings] = useState({
    is_enabled: false,
    app_id: '',
    rest_api_key: ''
  });

  const [brandingSettings, setBrandingSettings] = useState({
    logo_url: '',
    logo_mini_url: '',
    favicon_url: '',
    watermark_url: '',
    is_watermark_enabled: false,
    qr_sound_url: '',
    bill_sound_url: '',
    payout_sound_url: '',
    kyc_sound_url: '',
    is_qr_sound_enabled: true,
    is_bill_sound_enabled: true,
    is_payout_sound_enabled: true,
    is_kyc_sound_enabled: true,
    is_service_on_sound_enabled: true,
    is_service_off_sound_enabled: true,
    is_bill_enabled: true,
    service_on_sound_url: '',
    service_off_sound_url: '',
    is_animation_enabled: true
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoMiniFile, setLogoMiniFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [watermarkFile, setWatermarkFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoMiniPreview, setLogoMiniPreview] = useState<string | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [watermarkPreview, setWatermarkPreview] = useState<string | null>(null);

  const [qrSoundFile, setQrSoundFile] = useState<File | null>(null);
  const [billSoundFile, setBillSoundFile] = useState<File | null>(null);
  const [payoutSoundFile, setPayoutSoundFile] = useState<File | null>(null);
  const [kycSoundFile, setKycSoundFile] = useState<File | null>(null);
  const [serviceOnSoundFile, setServiceOnSoundFile] = useState<File | null>(null);
  const [serviceOffSoundFile, setServiceOffSoundFile] = useState<File | null>(null);

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [whatsappTestLoading, setWhatsappTestLoading] = useState(false);
  const [testWA, setTestWA] = useState('');

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
          provider: waData.provider || 'meta',
          access_token: waData.access_token || '',
          phone_number_id: waData.phone_number_id || '',
          sender_number: waData.sender_number || '',
          aisensy_api_key: waData.aisensy_api_key || '',
          aisensy_campaign_name: waData.aisensy_campaign_name || ''
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

      // 3. Branding & Sound Settings (from qr_settings)
      const { data: qrData, error: qrError } = await supabase
        .from('qr_settings')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (qrError && qrError.code !== 'PGRST116') throw qrError;
      if (qrData) {
        setBrandingSettings({
          logo_url: qrData.logo_url || '',
          logo_mini_url: qrData.logo_mini_url || '',
          favicon_url: qrData.favicon_url || '',
          watermark_url: qrData.watermark_url || '',
          is_watermark_enabled: qrData.is_watermark_enabled || false,
          qr_sound_url: qrData.qr_sound_url || '',
          bill_sound_url: qrData.bill_sound_url || '',
          payout_sound_url: qrData.payout_sound_url || '',
          kyc_sound_url: qrData.kyc_sound_url || '',
          is_qr_sound_enabled: qrData.is_qr_sound_enabled ?? true,
          is_bill_sound_enabled: qrData.is_bill_sound_enabled ?? true,
          is_payout_sound_enabled: qrData.is_payout_sound_enabled ?? true,
          is_kyc_sound_enabled: qrData.is_kyc_sound_enabled ?? true,
          is_service_on_sound_enabled: qrData.is_service_on_sound_enabled ?? true,
          is_service_off_sound_enabled: qrData.is_service_off_sound_enabled ?? true,
          is_bill_enabled: qrData.is_bill_enabled ?? true,
          service_on_sound_url: qrData.service_on_sound_url || '',
          service_off_sound_url: qrData.service_off_sound_url || '',
          is_animation_enabled: qrData.is_animation_enabled ?? true
        });
        setLogoPreview(qrData.logo_url);
        setLogoMiniPreview(qrData.logo_mini_url);
        setFaviconPreview(qrData.favicon_url);
        setWatermarkPreview(qrData.watermark_url);
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
      const OneSignalDeferred = (window as any).OneSignalDeferred;
      if (!OneSignalDeferred) return;

      OneSignalDeferred.push(async (OneSignal: any) => {
        try {
          if (typeof OneSignal.init === 'function') {
            // Check Notifications namespace
            if (OneSignal.Notifications) {
              const pushEnabled = OneSignal.Notifications.permission;
              setIsSubscribed(pushEnabled === 'granted');
            }
            
            // Check User namespace
            if (OneSignal.User) {
              const pushId = OneSignal.User.PushSubscription?.id;
              if (pushId) {
                setPlayerId(pushId);
              }
            }
          }
        } catch (err) {
          // Silently handle if SDK is still proxying
        }
      });
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

      // 3. Save Branding Settings
      let finalLogoUrl = brandingSettings.logo_url;
      let finalLogoMiniUrl = brandingSettings.logo_mini_url;
      let finalFaviconUrl = brandingSettings.favicon_url;
      let finalWatermarkUrl = brandingSettings.watermark_url;
      let finalQrSoundUrl = brandingSettings.qr_sound_url;
      let finalBillSoundUrl = brandingSettings.bill_sound_url;
      let finalPayoutSoundUrl = brandingSettings.payout_sound_url;
      let finalKycSoundUrl = brandingSettings.kyc_sound_url;
      let finalServiceOnSoundUrl = brandingSettings.service_on_sound_url;
      let finalServiceOffSoundUrl = brandingSettings.service_off_sound_url;

      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `system_logo.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('site_assets')
          .upload(fileName, logoFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('site_assets').getPublicUrl(fileName);
        finalLogoUrl = `${publicUrl}?t=${Date.now()}`;
      }

      if (logoMiniFile) {
        const fileExt = logoMiniFile.name.split('.').pop();
        const fileName = `system_logo_mini.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('site_assets')
          .upload(fileName, logoMiniFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('site_assets').getPublicUrl(fileName);
        finalLogoMiniUrl = `${publicUrl}?t=${Date.now()}`;
      }

      if (faviconFile) {
        const fileExt = faviconFile.name.split('.').pop();
        const fileName = `system_favicon.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('site_assets')
          .upload(fileName, faviconFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('site_assets').getPublicUrl(fileName);
        finalFaviconUrl = `${publicUrl}?t=${Date.now()}`;
      }
      if (watermarkFile) {
        const fileExt = watermarkFile.name.split('.').pop();
        const fileName = `system_watermark.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('site_assets')
          .upload(fileName, watermarkFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('site_assets').getPublicUrl(fileName);
        finalWatermarkUrl = `${publicUrl}?t=${Date.now()}`;
      }

      // 4. Upload Sounds
      if (qrSoundFile) {
        const fileName = `sound_qr_${Date.now()}.mp3`;
        const { error: uploadError } = await supabase.storage.from('site_assets').upload(fileName, qrSoundFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('site_assets').getPublicUrl(fileName);
        finalQrSoundUrl = publicUrl;
      }
      if (billSoundFile) {
        const fileName = `sound_bill_${Date.now()}.mp3`;
        const { error: uploadError } = await supabase.storage.from('site_assets').upload(fileName, billSoundFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('site_assets').getPublicUrl(fileName);
        finalBillSoundUrl = publicUrl;
      }
      if (payoutSoundFile) {
        const fileName = `sound_payout_${Date.now()}.mp3`;
        const { error: uploadError } = await supabase.storage.from('site_assets').upload(fileName, payoutSoundFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('site_assets').getPublicUrl(fileName);
        finalPayoutSoundUrl = publicUrl;
      }
      if (kycSoundFile) {
        const fileName = `sound_kyc_${Date.now()}.mp3`;
        const { error: uploadError } = await supabase.storage.from('site_assets').upload(fileName, kycSoundFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('site_assets').getPublicUrl(fileName);
        finalKycSoundUrl = publicUrl;
      }
      if (serviceOnSoundFile) {
        const fileName = `sound_service_on_${Date.now()}.mp3`;
        const { error: uploadError } = await supabase.storage.from('site_assets').upload(fileName, serviceOnSoundFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('site_assets').getPublicUrl(fileName);
        finalServiceOnSoundUrl = publicUrl;
      }
      if (serviceOffSoundFile) {
        const fileName = `sound_service_off_${Date.now()}.mp3`;
        const { error: uploadError } = await supabase.storage.from('site_assets').upload(fileName, serviceOffSoundFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('site_assets').getPublicUrl(fileName);
        finalServiceOffSoundUrl = publicUrl;
      }

      const { error: qrError } = await supabase
        .from('qr_settings')
        .update({
          logo_url: finalLogoUrl,
          logo_mini_url: finalLogoMiniUrl,
          favicon_url: finalFaviconUrl,
          watermark_url: finalWatermarkUrl,
          is_watermark_enabled: brandingSettings.is_watermark_enabled,
          qr_sound_url: finalQrSoundUrl,
          bill_sound_url: finalBillSoundUrl,
          payout_sound_url: finalPayoutSoundUrl,
          kyc_sound_url: finalKycSoundUrl,
          is_qr_sound_enabled: brandingSettings.is_qr_sound_enabled,
          is_bill_sound_enabled: brandingSettings.is_bill_sound_enabled,
          is_payout_sound_enabled: brandingSettings.is_payout_sound_enabled,
          is_kyc_sound_enabled: brandingSettings.is_kyc_sound_enabled,
          is_service_on_sound_enabled: brandingSettings.is_service_on_sound_enabled,
          is_service_off_sound_enabled: brandingSettings.is_service_off_sound_enabled,
          service_on_sound_url: finalServiceOnSoundUrl,
          service_off_sound_url: finalServiceOffSoundUrl,
          is_bill_enabled: brandingSettings.is_bill_enabled,
          is_animation_enabled: brandingSettings.is_animation_enabled,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);

      if (qrError) throw qrError;

      setBrandingSettings({
        logo_url: finalLogoUrl,
        logo_mini_url: finalLogoMiniUrl,
        favicon_url: finalFaviconUrl,
        watermark_url: finalWatermarkUrl,
        is_watermark_enabled: brandingSettings.is_watermark_enabled,
        qr_sound_url: finalQrSoundUrl,
        bill_sound_url: finalBillSoundUrl,
        payout_sound_url: finalPayoutSoundUrl,
        kyc_sound_url: finalKycSoundUrl,
        is_qr_sound_enabled: brandingSettings.is_qr_sound_enabled,
        is_bill_sound_enabled: brandingSettings.is_bill_sound_enabled,
        is_payout_sound_enabled: brandingSettings.is_payout_sound_enabled,
        is_kyc_sound_enabled: brandingSettings.is_kyc_sound_enabled,
        is_service_on_sound_enabled: brandingSettings.is_service_on_sound_enabled,
        is_service_off_sound_enabled: brandingSettings.is_service_off_sound_enabled,
        service_on_sound_url: finalServiceOnSoundUrl,
        service_off_sound_url: finalServiceOffSoundUrl,
        is_bill_enabled: brandingSettings.is_bill_enabled,
        is_animation_enabled: brandingSettings.is_animation_enabled
      });
      setLogoFile(null);
      setLogoMiniFile(null);
      setFaviconFile(null);
      setWatermarkFile(null);
      setQrSoundFile(null);
      setBillSoundFile(null);
      setPayoutSoundFile(null);
      setKycSoundFile(null);
      setServiceOnSoundFile(null);
      setServiceOffSoundFile(null);

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
    const OneSignalDeferred = (window as any).OneSignalDeferred;
    if (!OneSignalDeferred) {
      setError('OneSignal SDK not loaded. Please check your internet and refresh.');
      return;
    }

    OneSignalDeferred.push(async (OneSignal: any) => {
      try {
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
    });
  };

  const handleTestWhatsApp = async () => {
    if (whatsappSettings.provider === 'meta' && (!whatsappSettings.access_token || !whatsappSettings.phone_number_id)) {
      setError('Please provide Meta API credentials before testing.');
      return;
    }
    if (whatsappSettings.provider === 'aisensy' && (!whatsappSettings.aisensy_api_key || !whatsappSettings.aisensy_campaign_name)) {
      setError('Please provide AiSensy API credentials before testing.');
      return;
    }
    if (!testWA) {
      setError('Please enter a WhatsApp number to receive the test message.');
      return;
    }

    setWhatsappTestLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/send-whatsapp-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsapp_number: testWA.startsWith('91') ? testWA : `91${testWA}`,
          proof_url: 'https://d3jt6ku4g6z5l8.cloudfront.net/IMAGE/6353da2e153a147b991dd812/4958901_highanglekidcheatingschooltestmin.jpg',
          credentials: {
            provider: whatsappSettings.provider,
            access_token: whatsappSettings.access_token,
            phone_number_id: whatsappSettings.phone_number_id,
            sender_number: whatsappSettings.sender_number,
            aisensy_api_key: whatsappSettings.aisensy_api_key,
            aisensy_campaign_name: whatsappSettings.aisensy_campaign_name
          }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send WhatsApp test');

      setSuccess(`Test WhatsApp message sent to ${testWA}!`);
    } catch (err: any) {
      console.error('WhatsApp Test Error:', err);
      setError('WhatsApp Test failed: ' + err.message);
    } finally {
      setWhatsappTestLoading(false);
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
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">WhatsApp Provider</label>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setWhatsappSettings(prev => ({ ...prev, provider: 'meta' }))}
                    className={`flex-1 py-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 font-bold ${whatsappSettings.provider === 'meta' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                  >
                    Meta Cloud API (Official)
                  </button>
                  <button 
                    onClick={() => setWhatsappSettings(prev => ({ ...prev, provider: 'aisensy' }))}
                    className={`flex-1 py-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 font-bold ${whatsappSettings.provider === 'aisensy' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                  >
                    AiSensy API
                  </button>
                </div>
              </div>

              {whatsappSettings.provider === 'meta' ? (
                <>
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
                </>
              ) : (
                <>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">AiSensy API Key</label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        type="text"
                        placeholder="Enter your AiSensy API Key..."
                        value={whatsappSettings.aisensy_api_key}
                        onChange={(e) => setWhatsappSettings(prev => ({ ...prev, aisensy_api_key: e.target.value }))}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Approved Campaign Name (Template)</label>
                    <div className="relative">
                      <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        type="text"
                        placeholder="e.g. payment_proof_notification"
                        value={whatsappSettings.aisensy_campaign_name}
                        onChange={(e) => setWhatsappSettings(prev => ({ ...prev, aisensy_campaign_name: e.target.value }))}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100/50 flex gap-3">
              <AlertCircle className="text-amber-600 shrink-0" size={18} />
              <div className="text-xs text-amber-800 leading-relaxed">
                <p className="font-bold mb-1">Important Note:</p>
                When **WhatsApp API Status** is ON, the system will automatically send payment proof screenshots to the WhatsApp number associated with the QR code upon approval. Ensure your Meta App is correctly configured with these credentials to avoid failures.
              </div>
            </div>

            {/* Test WhatsApp Section */}
            <div className="pt-6 border-t border-slate-100 flex flex-col md:flex-row items-end gap-4">
              <div className="flex-1 space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Test WhatsApp Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={testWA}
                    onChange={(e) => setTestWA(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>
              <button 
                onClick={handleTestWhatsApp}
                disabled={whatsappTestLoading}
                className="px-8 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2 disabled:opacity-50 h-[42px]"
              >
                {whatsappTestLoading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Send size={18} />
                )}
                Test API
              </button>
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

        {/* Branding Settings Section */}
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                <ImageIcon size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Branding & Identity</h3>
                <p className="text-xs text-slate-500">Customize the portal logo and browser icon.</p>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Logo Upload */}
              <div className="space-y-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Main Logo (Full Sidebar)</label>
                <div className="flex items-start gap-6">
                  <div className="w-32 h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl overflow-hidden flex items-center justify-center shrink-0">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo Preview" className="w-full h-full object-contain p-2" />
                    ) : (
                      <ImageIcon size={32} className="text-slate-200" />
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Best size: 512x128px (PNG).
                    </p>
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 cursor-pointer transition-all shadow-md shadow-indigo-100">
                      <Upload size={16} />
                      Upload Logo
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (!file.type.startsWith('image/')) {
                              setError('Please upload a valid image file for the logo.');
                              return;
                            }
                            setLogoFile(file);
                            setLogoPreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Mini Logo Upload */}
              <div className="space-y-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mini Logo (Collapsed Sidebar)</label>
                <div className="flex items-start gap-6">
                  <div className="w-32 h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl overflow-hidden flex items-center justify-center shrink-0">
                    {logoMiniPreview ? (
                      <img src={logoMiniPreview} alt="Mini Logo Preview" className="w-full h-full object-contain p-2" />
                    ) : (
                      <ImageIcon size={32} className="text-slate-200" />
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Best size: 128x128px (PNG).
                    </p>
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 cursor-pointer transition-all shadow-md shadow-emerald-100">
                      <Upload size={16} />
                      Upload Mini Logo
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (!file.type.startsWith('image/')) {
                              setError('Please upload a valid image file for the mini logo.');
                              return;
                            }
                            setLogoMiniFile(file);
                            setLogoMiniPreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Favicon Upload */}
              <div className="space-y-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Browser Favicon</label>
                <div className="flex items-start gap-6">
                  <div className="w-20 h-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden flex items-center justify-center shrink-0">
                    {faviconPreview ? (
                      <img src={faviconPreview} alt="Favicon Preview" className="w-full h-full object-contain p-3" />
                    ) : (
                      <ImageIcon size={24} className="text-slate-200" />
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Best size: 32x32px (PNG/ICO).
                    </p>
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 cursor-pointer transition-all shadow-md">
                      <Upload size={16} />
                      Upload Icon
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/png,image/x-icon,image/vnd.microsoft.icon"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setFaviconFile(file);
                            setFaviconPreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Watermark Logo Upload */}
              <div className="space-y-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Dedicated Watermark Logo</label>
                <div className="flex items-start gap-6">
                  <div className="w-20 h-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden flex items-center justify-center shrink-0">
                    {watermarkPreview ? (
                      <img src={watermarkPreview} alt="Watermark Preview" className="w-full h-full object-contain p-3" />
                    ) : (
                      <ImageIcon size={24} className="text-slate-200" />
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Used specifically for dashboard background. Transparent PNG recommended.
                    </p>
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 cursor-pointer transition-all shadow-md">
                      <Upload size={16} />
                      Upload Watermark
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setWatermarkFile(file);
                            setWatermarkPreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Watermark Toggle */}
              <div className="pt-6 border-t border-slate-50">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-600">
                      <ImageIcon size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Dashboard Watermark</h4>
                      <p className="text-[10px] text-slate-500 font-medium">Show a subtle logo watermark on user dashboard background.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setBrandingSettings(prev => ({ ...prev, is_watermark_enabled: !prev.is_watermark_enabled }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      brandingSettings.is_watermark_enabled ? 'bg-indigo-600' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        brandingSettings.is_watermark_enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Service Controls Section */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl">
              <SettingsIcon size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Service Controls</h3>
              <p className="text-xs text-slate-500">Enable or disable specific system services.</p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-600">
                  <Receipt size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Bill Payment Service</h4>
                  <p className="text-[10px] text-slate-500 font-medium">When disabled, users cannot submit new bill payments.</p>
                </div>
              </div>
              <button
                onClick={() => setBrandingSettings(prev => ({ ...prev, is_bill_enabled: !prev.is_bill_enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  brandingSettings.is_bill_enabled ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    brandingSettings.is_bill_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Animation Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-600">
                  <motion.div
                    animate={{ rotate: brandingSettings.is_animation_enabled ? 360 : 0 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <RefreshCw size={20} />
                  </motion.div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">User Panel Animations</h4>
                  <p className="text-[10px] text-slate-500 font-medium">Enable/Disable Subway Surfers coin animations for users.</p>
                </div>
              </div>
              <button
                onClick={() => setBrandingSettings(prev => ({ ...prev, is_animation_enabled: !prev.is_animation_enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  brandingSettings.is_animation_enabled ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    brandingSettings.is_animation_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Notification Sounds Section */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-2xl">
              <Volume2 size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Notification Sounds</h3>
              <p className="text-xs text-slate-500">Configure alert sounds for different request types.</p>
            </div>
          </div>

          <div className="p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                { id: 'qr', label: 'QR Payment Request', sound: brandingSettings.qr_sound_url, enabled: brandingSettings.is_qr_sound_enabled, setFile: setQrSoundFile },
                { id: 'bill', label: 'Bill Payment Request', sound: brandingSettings.bill_sound_url, enabled: brandingSettings.is_bill_sound_enabled, setFile: setBillSoundFile },
                { id: 'payout', label: 'Payout Request', sound: brandingSettings.payout_sound_url, enabled: brandingSettings.is_payout_sound_enabled, setFile: setPayoutSoundFile },
                { id: 'kyc', label: 'KYC Verification', sound: brandingSettings.kyc_sound_url, enabled: brandingSettings.is_kyc_sound_enabled, setFile: setKycSoundFile },
                { id: 'service_on', label: 'Service Turned ON', sound: brandingSettings.service_on_sound_url, enabled: brandingSettings.is_service_on_sound_enabled, setFile: setServiceOnSoundFile },
                { id: 'service_off', label: 'Service Turned OFF', sound: brandingSettings.service_off_sound_url, enabled: brandingSettings.is_service_off_sound_enabled, setFile: setServiceOffSoundFile }
              ].map((item) => (
                <div key={item.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900">{item.label}</h4>
                    <button
                      onClick={() => setBrandingSettings(prev => ({ ...prev, [`is_${item.id}_sound_enabled`]: !prev[`is_${item.id}_sound_enabled` as keyof typeof prev] }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        item.enabled ? 'bg-indigo-600' : 'bg-slate-200'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${item.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer transition-all shadow-sm w-full">
                        <Music size={14} className="shrink-0" />
                        <span className="truncate">{item.sound ? 'Change Sound' : 'Upload Sound'}</span>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="audio/mpeg"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) item.setFile(file);
                          }}
                        />
                      </label>
                    </div>
                    {item.sound || 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' ? (
                      <button
                        onClick={() => {
                          const audio = new Audio(item.sound || 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                          audio.play().catch(err => console.error('Preview play error:', err));
                        }}
                        className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all shrink-0"
                        title="Play Preview"
                      >
                        <Volume2 size={16} />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
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
