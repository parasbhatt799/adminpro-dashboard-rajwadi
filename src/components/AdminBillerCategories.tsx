import React, { useState, useEffect } from 'react';
import { ToggleLeft, ToggleRight, Save, ShieldCheck, Activity, Globe, Loader2, Info } from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface CategorySetting {
  id?: number;
  provider: string;
  category_name: string;
  is_active: boolean;
}

const CATEGORIES = [
  'Agent Collection', 'Broadband Postpaid', 'Cable TV', 'Clubs and Associations',
  'Credit Card', 'DTH', 'eChallan', 'Education Fees', 'Electricity', 'EV Recharge',
  'Fastag', 'Fleet Card Recharge', 'Gas', 'Housing Society', 'Insurance',
  'Landline Postpaid', 'Loan Repayment', 'LPG Gas', 'Mobile Postpaid', 'Mobile Prepaid',
  'Municipal Services', 'Municipal Taxes', 'National Pension System', 'NCMC Recharge',
  'Prepaid Meter', 'Rental', 'Subscription', 'Water'
];

export default function AdminBillerCategories() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'billavenue' | 'camlenio'>('billavenue');
  const [settings, setSettings] = useState<CategorySetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/biller-categories');
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();
      setSettings(data);
      setHasChanges(false);
    } catch (err: any) {
      toast.error('Could not load category settings');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryStatus = (provider: string, category: string) => {
    const setting = settings.find(s => s.provider === provider && s.category_name === category);
    return setting ? setting.is_active : true; // Default to true
  };

  const toggleCategory = (provider: string, category: string) => {
    setSettings(prev => {
      const existing = prev.find(s => s.provider === provider && s.category_name === category);
      if (existing) {
        return prev.map(s => s.provider === provider && s.category_name === category ? { ...s, is_active: !s.is_active } : s);
      }
      return [...prev, { provider, category_name: category, is_active: false }];
    });
    setHasChanges(true);
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/admin/biller-categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (!res.ok) throw new Error('Failed to save settings');
      toast.success('Category settings saved successfully');
      setHasChanges(false);
    } catch (err: any) {
      toast.error('Failed to save settings');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const setAll = (provider: string, status: boolean) => {
    setSettings(prev => {
      const newSettings = [...prev];
      CATEGORIES.forEach(cat => {
        const existingIdx = newSettings.findIndex(s => s.provider === provider && s.category_name === cat);
        if (existingIdx >= 0) {
          newSettings[existingIdx].is_active = status;
        } else {
          newSettings.push({ provider, category_name: cat, is_active: status });
        }
      });
      return newSettings;
    });
    setHasChanges(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Category Settings</h2>
          <p className="text-slate-500 font-medium mt-1">Manage which utility categories are visible to users.</p>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving || !hasChanges}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all ${
            saving || !hasChanges
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 hover:-translate-y-0.5'
          }`}
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          Save Changes
        </button>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/60">
        <div className="flex gap-4 border-b border-slate-100 pb-4 mb-6">
          <button
            onClick={() => setActiveTab('billavenue')}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all ${
              activeTab === 'billavenue'
                ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Globe size={18} />
            BillAvenue Categories
          </button>
          <button
            onClick={() => setActiveTab('camlenio')}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all ${
              activeTab === 'camlenio'
                ? 'bg-emerald-50 text-emerald-700 shadow-sm'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Activity size={18} />
            Camlenio (CSPL) Categories
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="animate-spin mb-4" size={32} />
            <p className="font-medium">Loading settings...</p>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-3 text-slate-600">
                <Info size={20} className="text-indigo-500" />
                <p className="text-sm font-medium">Changes made here will hide/show categories for users globally.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setAll(activeTab, true)}
                  className="px-4 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  Enable All
                </button>
                <button
                  onClick={() => setAll(activeTab, false)}
                  className="px-4 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors"
                >
                  Disable All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {CATEGORIES.map((category) => {
                const isActive = getCategoryStatus(activeTab, category);
                return (
                  <div 
                    key={category} 
                    className={`flex justify-between items-center p-4 rounded-2xl border transition-all ${
                      isActive 
                        ? 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-md' 
                        : 'bg-slate-50 border-slate-100 opacity-60 grayscale'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${isActive ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                        <ShieldCheck size={18} />
                      </div>
                      <span className="font-semibold text-sm text-slate-700">{category}</span>
                    </div>
                    
                    <button 
                      onClick={() => toggleCategory(activeTab, category)}
                      className={`transition-colors ${isActive ? 'text-emerald-500' : 'text-slate-300 hover:text-slate-400'}`}
                    >
                      {isActive ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
