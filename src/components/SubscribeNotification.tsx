import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellOff, BellRing, CheckCircle2, AlertCircle, ArrowRight, Loader2, Send, Smartphone, UserCheck, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, addDevicePushId } from '../lib/supabase';

export default function SubscribeNotification() {
  const [mobileNumber, setMobileNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminFound, setAdminFound] = useState(false);
  const [playerId, setPlayerId] = useState('');
  const [permissionState, setPermissionState] = useState<'default' | 'granted' | 'denied'>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState('');

  // 1. Fetch current OneSignal subscription state from browser SDK
  const checkOneSignalState = () => {
    const OneSignalDeferred = (window as any).OneSignalDeferred;
    if (!OneSignalDeferred) return;

    OneSignalDeferred.push((OneSignal: any) => {
      if (OneSignal.Notifications) {
        setPermissionState(OneSignal.Notifications.permission);
      }
      if (OneSignal.User?.PushSubscription) {
        const id = OneSignal.User.PushSubscription.id;
        setPlayerId(id || '');
        setIsSubscribed(!!id && OneSignal.User.PushSubscription.optedIn);
      }
    });
  };

  useEffect(() => {
    checkOneSignalState();
    // Check again after 1.5 seconds in case OneSignal is still loading
    const timer = setTimeout(checkOneSignalState, 1500);
    return () => clearTimeout(timer);
  }, []);

  // 2. Lookup Admin Profile by Mobile Number
  const handleVerifyMobile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileNumber.trim()) {
      setError('કૃપા કરીને તમારો મોબાઈલ નંબર દાખલ કરો.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Normalize number
      const cleanNum = mobileNumber.replace(/\D/g, '').slice(-10);
      if (cleanNum.length !== 10) {
        setError('મહેરબાની કરીને સાચો 10-અંકનો મોબાઈલ નંબર નાખો.');
        setLoading(false);
        return;
      }

      // Query database
      const { data: adminProfile, error: dbErr } = await supabase
        .from('admin_profiles')
        .select('name, mobile_number, onesignal_id')
        .eq('mobile_number', cleanNum)
        .maybeSingle();

      if (dbErr || !adminProfile) {
        setError('આ મોબાઈલ નંબર કોઈ એડમિન પ્રોફાઈલ સાથે લિંક નથી.');
        setAdminFound(false);
        setAdminName('');
      } else {
        setAdminName(adminProfile.name || 'Admin');
        setAdminFound(true);
        setMobileNumber(cleanNum); // Use normalized 10 digits
        setSuccess(`પ્રોફાઇલ મળી ગઈ: ${adminProfile.name}`);
      }
    } catch (err: any) {
      console.error('Verify admin mobile error:', err);
      setError('પ્રોફાઇલ શોધવામાં સમસ્યા આવી. ફરી પ્રયત્ન કરો.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Trigger Subscription & Opt-In Synchronously on Click
  const handleSubscribe = async () => {
    if (!adminFound || !mobileNumber) return;
    setLoading(true);
    setError('');

    const OneSignal = (window as any).OneSignal;
    if (!OneSignal) {
      setError('OneSignal SDK લોડ થયું નથી. મહેરબાની કરીને તમારું ઇન્ટરનેટ ચેક કરી રીફ્રેશ કરો.');
      setLoading(false);
      return;
    }

    // Check if permission is already denied
    if (OneSignal.Notifications && OneSignal.Notifications.permission === 'denied') {
      setError('બ્રાઉઝર પરમિશન બ્લોક કરેલી છે. કૃપા કરીને બ્રાઉઝર સેટિંગ્સમાંથી પરમિશન Allow કરો.');
      setLoading(false);
      return;
    }

    try {
      // Request browser permission synchronously with a timeout
      console.log('[SubscribePage] Requesting browser notification permission...');
      if (OneSignal.Notifications) {
        await Promise.race([
          OneSignal.Notifications.requestPermission(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_PERMISSION')), 6000))
        ]);
      }

      // Opt in push subscription with a timeout
      if (OneSignal.User?.PushSubscription) {
        await Promise.race([
          OneSignal.User.PushSubscription.optIn(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_OPTIN')), 6000))
        ]);
        
        const pId = OneSignal.User.PushSubscription.id;
        
        if (pId) {
          setPlayerId(pId);
          setIsSubscribed(true);
          setPermissionState(OneSignal.Notifications?.permission || 'granted');

          // Sync with database
          await addDevicePushId(mobileNumber, 'admin', pId);
          setSuccess(`અભિનંદન! ${adminName} માટે લાઈવ નોટિફિકેશન એક્ટિવેટ થઈ ગઈ છે.`);
        } else {
          throw new Error('TIMEOUT_OPTIN'); // Trigger timeout message if push subscription doesn't resolve an ID
        }
      } else {
        throw new Error('OneSignal પુશ સબસ્ક્રિપ્શન સર્વિસ ઉપલબ્ધ નથી.');
      }
    } catch (err: any) {
      console.error('Subscription error:', err);
      if (err.message === 'TIMEOUT_PERMISSION' || err.message === 'TIMEOUT_OPTIN') {
        setError('નોટિફિકેશન ચાલુ કરવાનો પ્રયાસ સમયસીમા (Timeout) વટાવી ગયો છે. કૃપા કરીને ખાતરી કરો કે તમે આ લિંક સીધી Chrome અથવા Safari બ્રાઉઝરમાં ખોલી છે (WhatsApp કે Telegram ની અંદર નહીં). જો તમે iPhone વાપરતા હોવ, તો "Add to Home Screen" કરી તે ઇન્સ્ટોલ કરેલી એપ ઓપન કરો.');
      } else {
        setError(err.message || 'નોટિફિકેશન ચાલુ કરવામાં સમસ્યા આવી.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 4. Send Live Test Push Notification
  const handleSendTestNotification = async () => {
    if (!playerId) {
      setError('પહેલાં નોટિફિકેશન સબસ્ક્રાઇબ કરો.');
      return;
    }
    setTestSending(true);
    setTestResult('');
    setError('');

    try {
      const response = await fetch('/api/send-push-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'UsePay Live Alert Test 🔔',
          message: `નમસ્તે ${adminName || 'Admin'}, તમારા મોબાઈલમાં પુશ નોટિફિકેશન સફળતાપૂર્વક ચાલુ થઈ ગઈ છે!`,
          player_ids: [playerId],
          target: 'custom'
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setTestResult('ટેસ્ટ એલર્ટ મોકલી દેવાયું છે! તમારા ફોન પર પુશ નોટિફિકેશન ચેક કરો.');
      } else {
        setError(result.error || 'ટેસ્ટ એલર્ટ મોકલવામાં નિષ્ફળતા.');
      }
    } catch (err: any) {
      console.error('Send test notification error:', err);
      setError('સર્વર સાથે કનેક્ટ થવામાં ભૂલ આવી.');
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 relative">
      {/* Ambient background glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl">
          {/* Header */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 bg-indigo-600/20 rounded-2xl flex items-center justify-center mb-4">
              <BellRing className="text-indigo-400 animate-bounce" size={32} />
            </div>
            <h2 className="text-xl font-bold text-white tracking-wide text-center">UsePay Live Alert Activation</h2>
            <p className="text-slate-400 text-xs mt-2 text-center">
              એડમિન મોબાઈલ ફોન પર લાઈવ પુશ એલર્ટ્સ સબસ્ક્રાઇબ કરવા માટેનું પેજ
            </p>
          </div>

          {/* Quick Refresh Icon */}
          <div className="flex justify-end mb-2">
            <button
              onClick={checkOneSignalState}
              className="text-xs font-bold text-slate-500 hover:text-indigo-400 transition-colors flex items-center gap-1"
              title="રીફ્રેશ સ્ટેટસ"
            >
              <RefreshCw size={12} /> સ્ટેટસ ચેક કરો
            </button>
          </div>

          {/* Permission Badge */}
          <div className="mb-6 bg-slate-950/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              બ્રાઉઝર પરમિશન:
            </span>
            {permissionState === 'granted' ? (
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Active / Granted
              </span>
            ) : permissionState === 'denied' ? (
              <span className="px-3 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full text-xs font-bold">
                ⚠️ Blocked / Denied
              </span>
            ) : (
              <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-xs font-bold">
                🔍 Not Configured (Default)
              </span>
            )}
          </div>

          {/* Main Form Flow */}
          <AnimatePresence mode="wait">
            {!adminFound ? (
              // STEP 1: Enter Mobile Number
              <motion.form
                key="verify-mobile"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleVerifyMobile}
                className="space-y-6"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                    તમારો એડમિન મોબાઈલ નંબર (10 અંક)
                  </label>
                  <div className="relative">
                    <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input
                      type="tel"
                      value={mobileNumber}
                      onChange={(e) => {
                        setMobileNumber(e.target.value);
                        setError('');
                      }}
                      placeholder="e.g. 7777077377"
                      maxLength={10}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium"
                    />
                  </div>
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-rose-400 text-xs font-bold mt-2 ml-1 flex items-center gap-1.5"
                  >
                    <AlertCircle size={14} /> {error}
                  </motion.p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : 'પ્રોફાઇલ શોધો'}
                  {!loading && <ArrowRight size={18} />}
                </button>
              </motion.form>
            ) : (
              // STEP 2: Profile Found - Allow / Test Action
              <motion.div
                key="subscribe-action"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                {/* User Card */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600/20 rounded-full flex items-center justify-center">
                      <UserCheck className="text-indigo-400" size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{adminName}</p>
                      <p className="text-slate-400 text-xs">{mobileNumber}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setAdminFound(false);
                      setSuccess('');
                      setError('');
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-indigo-400 transition-colors"
                  >
                    બદલો
                  </button>
                </div>

                {error && (
                  <p className="text-rose-400 text-xs font-bold flex items-center gap-1.5">
                    <AlertCircle size={14} /> {error}
                  </p>
                )}

                {success && (
                  <p className="text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> {success}
                  </p>
                )}

                <div className="space-y-4">
                  {/* Action 1: Subscribe if not subscribed or if default */}
                  {(!isSubscribed || permissionState !== 'granted') ? (
                    <button
                      onClick={handleSubscribe}
                      disabled={loading}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98] disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="animate-spin" size={18} /> : '🔔 Enable Live Alerts (નોટિફિકેશન ચાલુ કરો)'}
                    </button>
                  ) : (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
                      <p className="text-xs font-bold text-emerald-400">
                        તમારા આ ફોન પર લાઈવ નોટિફિકેશન સેટ થઈ ગઈ છે!
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1 truncate">
                        ID: {playerId}
                      </p>
                    </div>
                  )}

                  {/* Action 2: Send Test Notification */}
                  <button
                    onClick={handleSendTestNotification}
                    disabled={testSending}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 border border-white/5 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {testSending ? <Loader2 className="animate-spin" size={18} /> : <Send size={16} />}
                    <span>Send Test Alert (ટેસ્ટ એલર્ટ મોકલો)</span>
                  </button>
                </div>

                {testResult && (
                  <motion.p
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-emerald-400 text-xs font-bold text-center mt-2"
                  >
                    {testResult}
                  </motion.p>
                )}

                {permissionState === 'denied' && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-xs text-amber-400">
                    <p className="font-bold mb-1">નોંધ (Instructions for Blocked permission):</p>
                    <p className="leading-relaxed">
                      બ્રાઉઝરે નોટિફિકેશન બ્લોક કરેલ છે. ફરીથી ચાલુ કરવા માટે બ્રાઉઝરની એડ્રેસ બારમાં ડાબી બાજુએ આપેલા <strong>સેટિંગ્સ (આઇકોન/લોક)</strong> પર ક્લિક કરી પરમિશન <strong>Allow</strong> કરો અને આ પેજ રીફ્રેશ કરો.
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer Back Link */}
          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <Link to="/" className="text-xs font-bold text-slate-500 hover:text-indigo-400 transition-colors">
              મુખ્ય પેજ પર પાછા જાઓ
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
