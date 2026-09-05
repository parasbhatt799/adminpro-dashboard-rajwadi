import React, { useState, useEffect } from 'react';
import { QrCode, RefreshCw, Send, CheckCircle2, AlertCircle, Phone, MessageSquare, ShieldCheck, Smartphone, Zap, X, Save, Users } from 'lucide-react';

interface WhatsAppStatus {
  isConnected: boolean;
  isInitializing: boolean;
  qrCodeDataUrl: string | null;
  connectedPhone: string | null;
  lastQrTimestamp: string | null;
  initError?: string | null;
}

export default function B2BWhatsAppManager() {
  const [status, setStatus] = useState<WhatsAppStatus>({
    isConnected: false,
    isInitializing: false,
    qrCodeDataUrl: null,
    connectedPhone: null,
    lastQrTimestamp: null,
    initError: null
  });
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [restarting, setRestarting] = useState(false);
  const [toastBanner, setToastBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Admin Notification Numbers State
  const [adminNumbersInput, setAdminNumbersInput] = useState('');
  const [savingNumbers, setSavingNumbers] = useState(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToastBanner({ type, message });
    setTimeout(() => setToastBanner(null), 4000);
  };

  // Test Message State
  const [testMobile, setTestMobile] = useState('');
  const [testMessage, setTestMessage] = useState('Hello from B2B WhatsApp Bot! Your connection is active.');
  const [sendingTest, setSendingTest] = useState(false);

  const fetchAdminNumbers = async () => {
    try {
      const res = await fetch('/api/v1/b2b/admin/whatsapp/admin-numbers');
      const data = await res.json();
      if (data.success && data.adminNumbers) {
        setAdminNumbersInput(data.adminNumbers);
      }
    } catch (err) {
      console.error('Error fetching admin numbers:', err);
    }
  };

  const handleSaveAdminNumbers = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingNumbers(true);
      const res = await fetch('/api/v1/b2b/admin/whatsapp/admin-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNumbers: adminNumbersInput })
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', 'Admin WhatsApp notification numbers saved successfully!');
      } else {
        showToast('error', data.error || 'Failed to save admin numbers');
      }
    } catch (err) {
      showToast('error', 'Error saving admin numbers');
    } finally {
      setSavingNumbers(false);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/v1/b2b/admin/whatsapp/status');
      const data = await res.json();
      if (data.success) {
        setStatus({
          isConnected: data.isConnected,
          isInitializing: data.isInitializing,
          qrCodeDataUrl: data.qrCodeDataUrl,
          connectedPhone: data.connectedPhone,
          lastQrTimestamp: data.lastQrTimestamp,
          initError: data.initError || null
        });
      }
    } catch (err) {
      console.error('Error fetching WhatsApp status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchAdminNumbers();
    // Poll every 3 seconds to auto-detect QR scan completion
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleRestart = async () => {
    try {
      setRestarting(true);
      const res = await fetch('/api/v1/b2b/admin/whatsapp/restart', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('success', 'WhatsApp Bot restarting...');
        fetchStatus();
      } else {
        showToast('error', data.error || 'Failed to restart bot');
      }
    } catch (err) {
      showToast('error', 'Error restarting WhatsApp bot');
    } finally {
      setRestarting(false);
    }
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testMobile) {
      showToast('error', 'Please enter a mobile number');
      return;
    }
    if (!testMessage) {
      showToast('error', 'Please enter a message');
      return;
    }

    try {
      setSendingTest(true);
      const res = await fetch('/api/v1/b2b/admin/whatsapp/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNumber: testMobile, message: testMessage })
      });
      const data = await res.json();

      if (data.success) {
        showToast('success', 'Test WhatsApp message sent successfully!');
      } else {
        showToast('error', data.error || 'Failed to send test message');
      }
    } catch (err) {
      showToast('error', 'Failed to send test message');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Toast Notification Banner */}
      {toastBanner && (
        <div className={`p-4 rounded-2xl flex items-center justify-between shadow-lg border backdrop-blur-md ${
          toastBanner.type === 'success' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
        }`}>
          <span className="text-sm font-semibold">{toastBanner.message}</span>
          <button onClick={() => setToastBanner(null)} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/90 backdrop-blur-sm p-6 rounded-2xl border border-slate-700 shadow-xl">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-7 h-7 text-emerald-400" />
            B2B WhatsApp Automation Bot
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            100% Free Self-Hosted WhatsApp Bot for B2B Fund Request Notifications
          </p>
        </div>
        <button
          onClick={handleRestart}
          disabled={restarting}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700/80 hover:bg-slate-600 text-slate-200 text-sm font-semibold rounded-xl border border-slate-600 transition-all disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${restarting ? 'animate-spin' : ''}`} />
          Restart Bot
        </button>
      </div>

      {/* 3 Sections in 1 Single Row (3 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SECTION 1: Connection Status & QR Code */}
        <div className="bg-slate-800/90 backdrop-blur-sm rounded-2xl border border-slate-700 p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-700/80">
              <h2 className="font-bold text-white text-lg flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-indigo-400" />
                Connection Status
              </h2>
              {status.isConnected ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-xs rounded-full uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4" /> Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-xs rounded-full uppercase tracking-wider">
                  <AlertCircle className="w-4 h-4" /> Disconnected
                </span>
              )}
            </div>

            {/* Connected State */}
            {status.isConnected ? (
              <div className="my-6 p-5 bg-slate-900/90 border border-emerald-500/30 rounded-2xl text-center space-y-3">
                <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner border border-emerald-500/30">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">WhatsApp Bot is Active!</h3>
                  {status.connectedPhone && (
                    <p className="text-xs font-bold text-emerald-400 mt-1 flex items-center justify-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> Linked: +{status.connectedPhone}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                    Session saved in local auth. Automatic notifications will be sent for B2B Fund Requests.
                  </p>
                </div>
              </div>
            ) : status.qrCodeDataUrl ? (
              /* QR Code State */
              <div className="my-6 text-center space-y-3">
                <div className="inline-block p-3 bg-white border-2 border-dashed border-indigo-500/40 rounded-2xl shadow-xl">
                  <img
                    src={status.qrCodeDataUrl}
                    alt="WhatsApp QR Code"
                    className="w-48 h-48 mx-auto rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-white text-xs">Scan QR Code with WhatsApp</p>
                  <p className="text-[11px] text-slate-400">
                    Open WhatsApp &gt; Linked Devices &gt; Link a Device
                  </p>
                </div>
              </div>
            ) : (
              /* Initializing / Loading State */
              <div className="my-8 text-center py-4 space-y-3">
                <RefreshCw className={`w-8 h-8 ${status.isInitializing ? 'text-indigo-400 animate-spin' : 'text-slate-500'} mx-auto`} />
                <div>
                  <p className="font-semibold text-slate-200 text-xs">
                    {status.isInitializing ? 'Starting WhatsApp Web Client...' : status.initError ? 'Initialization Notice' : 'Generating QR Code...'}
                  </p>
                  {status.initError ? (
                    <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 p-2 rounded-xl mt-2 max-w-xs mx-auto font-medium">
                      ⚠️ {status.initError}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400 mt-1">Please wait a few moments for QR code to load.</p>
                  )}
                </div>
                <button
                  onClick={handleRestart}
                  disabled={restarting}
                  className="px-3.5 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${restarting ? 'animate-spin' : ''}`} />
                  {restarting ? 'Initializing...' : 'Force Generate QR Code'}
                </button>
              </div>
            )}
          </div>

          {/* Triggers Summary at Bottom of Column 1 */}
          <div className="pt-3 border-t border-slate-700/80 bg-slate-900/60 -mx-6 -mb-6 p-4 rounded-b-2xl mt-4">
            <h4 className="text-[10px] font-extrabold uppercase text-slate-400 mb-2 tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> Configured B2B Triggers
            </h4>
            <div className="space-y-1 text-[11px] text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                <span><b>New B2B Request:</b> Alert to Admin.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                <span><b>Request Approved:</b> Alert to B2B Agent.</span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: Send Test WhatsApp Message */}
        <div className="bg-slate-800/90 backdrop-blur-sm rounded-2xl border border-slate-700 p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="font-bold text-white text-lg pb-4 border-b border-slate-700/80 flex items-center gap-2">
              <Send className="w-5 h-5 text-emerald-400" />
              Send Test Message
            </h2>

            <form onSubmit={handleSendTestMessage} className="mt-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Mobile Number (10 Digits / with 91)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={testMobile}
                    onChange={(e) => setTestMobile(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-white placeholder:text-slate-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Message Content
                </label>
                <textarea
                  rows={4}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full p-3 text-xs sm:text-sm bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-white placeholder:text-slate-500"
                  placeholder="Enter test message..."
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={sendingTest || !status.isConnected}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2 text-xs sm:text-sm disabled:opacity-50 cursor-pointer"
              >
                {sendingTest ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Sending Message...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Send Test Message
                  </>
                )}
              </button>

              {!status.isConnected && (
                <p className="text-[11px] text-amber-400 text-center font-medium">
                  ⚠️ Scan QR code first to connect WhatsApp bot.
                </p>
              )}
            </form>
          </div>
        </div>

        {/* SECTION 3: Admin Notification Mobile Numbers */}
        <div className="bg-slate-800/90 backdrop-blur-sm rounded-2xl border border-slate-700 p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="pb-4 border-b border-slate-700/80">
              <h2 className="font-bold text-white text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                Admin WhatsApp Numbers
              </h2>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                WhatsApp numbers that will receive instant payment alerts & receipt photos for new B2B Fund Requests.
              </p>
            </div>

            <form onSubmit={handleSaveAdminNumbers} className="mt-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Admin Numbers (Comma Separated)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210, 9123456789"
                    value={adminNumbersInput}
                    onChange={(e) => setAdminNumbersInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-white font-mono placeholder:text-slate-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  💡 Example: <code className="bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded text-indigo-300 font-mono font-bold text-[10px]">9876543210, 9123456789</code>
                </p>
              </div>

              <button
                type="submit"
                disabled={savingNumbers}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {savingNumbers ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Saving Numbers...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Save Admin Numbers
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
