import React, { useState, useEffect } from 'react';
import { QrCode, RefreshCw, Send, CheckCircle2, AlertCircle, Phone, MessageSquare, ShieldCheck, Smartphone, Zap, X, Save, Users } from 'lucide-react';

interface WhatsAppStatus {
  isConnected: boolean;
  isInitializing: boolean;
  qrCodeDataUrl: string | null;
  connectedPhone: string | null;
  lastQrTimestamp: string | null;
}

export default function B2BWhatsAppManager() {
  const [status, setStatus] = useState<WhatsAppStatus>({
    isConnected: false,
    isInitializing: false,
    qrCodeDataUrl: null,
    connectedPhone: null,
    lastQrTimestamp: null
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
          lastQrTimestamp: data.lastQrTimestamp
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
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {toastBanner && (
        <div className={`p-4 rounded-xl flex items-center justify-between shadow-sm border ${
          toastBanner.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <span className="text-sm font-semibold">{toastBanner.message}</span>
          <button onClick={() => setToastBanner(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-7 h-7 text-emerald-600" />
            B2B WhatsApp Automation Bot
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            100% Free Self-Hosted WhatsApp Bot for B2B Fund Request Notifications
          </p>
        </div>
        <button
          onClick={handleRestart}
          disabled={restarting}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${restarting ? 'animate-spin' : ''}`} />
          Restart Bot
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status & QR Code Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-indigo-600" />
                Connection Status
              </h2>
              {status.isConnected ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 font-bold text-xs rounded-full uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4" /> Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 font-bold text-xs rounded-full uppercase tracking-wider">
                  <AlertCircle className="w-4 h-4" /> Disconnected
                </span>
              )}
            </div>

            {/* Connected State */}
            {status.isConnected ? (
              <div className="my-6 p-6 bg-emerald-50/60 border border-emerald-200 rounded-2xl text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <ShieldCheck className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">WhatsApp Bot is Active!</h3>
                  {status.connectedPhone && (
                    <p className="text-sm font-semibold text-emerald-800 mt-1 flex items-center justify-center gap-1.5">
                      <Phone className="w-4 h-4" /> Linked Number: +{status.connectedPhone}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mt-2">
                    Session saved in local auth. Automatic notifications will be sent for B2B Fund Requests.
                  </p>
                </div>
              </div>
            ) : status.qrCodeDataUrl ? (
              /* QR Code State */
              <div className="my-6 text-center space-y-4">
                <div className="inline-block p-4 bg-white border-2 border-dashed border-indigo-200 rounded-2xl shadow-md">
                  <img
                    src={status.qrCodeDataUrl}
                    alt="WhatsApp QR Code"
                    className="w-56 h-56 mx-auto rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-slate-800 text-sm">Scan QR Code with WhatsApp</p>
                  <p className="text-xs text-slate-500">
                    Open WhatsApp &gt; Menu &gt; Linked Devices &gt; Link a Device
                  </p>
                </div>
              </div>
            ) : (
              /* Initializing / Loading State */
              <div className="my-10 text-center py-6 space-y-4">
                <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin mx-auto" />
                <div>
                  <p className="font-semibold text-slate-700 text-sm">
                    {status.isInitializing ? 'Starting WhatsApp Web Client...' : 'Generating QR Code...'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Please wait a few moments for the QR code to load.</p>
                </div>
                <button
                  onClick={handleRestart}
                  disabled={restarting}
                  className="px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-200 text-xs font-bold rounded-xl hover:bg-indigo-100 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${restarting ? 'animate-spin' : ''}`} />
                  {restarting ? 'Initializing...' : 'Force Generate QR Code'}
                </button>
              </div>
            )}
          </div>

          {/* Triggers Summary */}
          <div className="pt-4 border-t border-slate-100 bg-slate-50/80 -mx-6 -mb-6 p-4 rounded-b-2xl">
            <h4 className="text-xs font-bold uppercase text-slate-500 mb-2 tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> Configured B2B Triggers
            </h4>
            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span><b>New B2B Fund Request:</b> Sends alert to Admin WhatsApp.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span><b>Fund Request Approved:</b> Sends confirmation to B2B Agent WhatsApp.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Test Message Form */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="font-bold text-slate-900 text-lg pb-4 border-b border-slate-100 flex items-center gap-2">
              <Send className="w-5 h-5 text-emerald-600" />
              Send Test WhatsApp Message
            </h2>

            <form onSubmit={handleSendTestMessage} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mobile Number (with country code or 10 digits)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={testMobile}
                    onChange={(e) => setTestMobile(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Message Content
                </label>
                <textarea
                  rows={4}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full p-3 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-slate-800"
                  placeholder="Enter test message..."
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={sendingTest || !status.isConnected}
                className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
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
                <p className="text-xs text-amber-600 text-center font-medium">
                  ⚠️ Scan QR code first to connect WhatsApp bot before sending test messages.
                </p>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Admin WhatsApp Numbers Settings Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Admin Notification Mobile Numbers
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter the WhatsApp numbers that will receive instant alerts & payment proof photos for new B2B Fund Requests.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveAdminNumbers} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Admin Mobile Numbers (comma separated for multiple numbers)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Phone className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="e.g. 9876543210, 9123456789"
                value={adminNumbersInput}
                onChange={(e) => setAdminNumbersInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-800 font-mono"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              💡 Example: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-bold">9876543210, 9123456789</code> (All numbers added here will receive proof images & notifications).
            </p>
          </div>

          <button
            type="submit"
            disabled={savingNumbers}
            className="px-6 py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
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
  );
}
