import React, { useState, useEffect } from 'react';
import { CreditCard, Search, Save, CheckCircle2, XCircle, ToggleLeft, ToggleRight, RefreshCw, Building2, Sparkles, Filter, ShieldCheck, HelpCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';

interface CCBillerItem {
  biller_id: string;
  biller_name: string;
  category: string;
  metadata: any;
  is_enabled: boolean;
}

const getBankLogoUrl = (billerName: string): string | null => {
  const name = billerName.toLowerCase().trim();
  if (name.includes('au bank') || name.includes('au_bank')) return '/bank_logos/au.png';
  if (name.includes('axis')) return '/bank_logos/axis.png';
  if (name.includes('bandhan')) return '/bank_logos/bandhan.png';
  if (name.includes('bob') || name.includes('baroda') || name.includes('bobcard')) return '/bank_logos/bob.png';
  if (name.includes('bank of india') || name.includes('boi')) return '/bank_logos/boi.png';
  if (name.includes('canara')) return '/bank_logos/canara.png';
  if (name.includes('csb')) return '/bank_logos/csb.png';
  if (name.includes('cub') || name.includes('city union')) return '/bank_logos/cub.png';
  if (name.includes('dcb')) return '/bank_logos/dcb.png';
  if (name.includes('dhanlaxmi') || name.includes('dhanbank')) return '/bank_logos/dhanlaxmi.png';
  if (name.includes('esaf')) return '/bank_logos/esaf.png';
  if (name.includes('federal')) return '/bank_logos/federal.png';
  if (name.includes('icici')) return '/bank_logos/icici.png';
  if (name.includes('idbi')) return '/bank_logos/idbi.png';
  if (name.includes('idfc')) return '/bank_logos/idfc.png';
  if (name.includes('indian bank') || name.includes('indianbank')) return '/bank_logos/indian.png';
  if (name.includes('indusind')) return '/bank_logos/indusind.png';
  if (name.includes('iob') || name.includes('overseas')) return '/bank_logos/iob.png';
  if (name.includes('j and k') || name.includes('j&k') || name.includes('jammu')) return '/bank_logos/jk.png';
  if (name.includes('onecard') || name.includes('slice') || name.includes('one credit')) return '/bank_logos/onecard.png';
  if (name.includes('pnb') || name.includes('punjab')) return '/bank_logos/pnb.png';
  if (name.includes('saraswat')) return '/bank_logos/saraswat.png';
  if (name.includes('sbi') || name.includes('state bank')) return '/bank_logos/sbi.png';
  if (name.includes('sbm')) return '/bank_logos/sbm.png';
  if (name.includes('sib') || name.includes('south indian')) return '/bank_logos/sib.png';
  if (name.includes('suryoday')) return '/bank_logos/suryoday.png';
  if (name.includes('tmb') || name.includes('tamilnad')) return '/bank_logos/tmb.png';
  if (name.includes('union bank')) return '/bank_logos/union.png';
  if (name.includes('kotak')) return '/kotak_logo.png';
  return null;
};

export default function AdminCCBillerManagement() {
  const toast = useToast();
  const [billers, setBillers] = useState<CCBillerItem[]>([]);
  const [initialBillers, setInitialBillers] = useState<CCBillerItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  useEffect(() => {
    fetchCCBillers();
  }, []);

  const fetchCCBillers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('billavenue_billers')
        .select('*')
        .eq('category', 'Credit Card')
        .order('biller_name', { ascending: true });

      if (error) throw error;

      const mapped: CCBillerItem[] = (data || [])
        .filter((b: any) => {
          const name = (b.biller_name || '').toLowerCase();
          return !name.includes('postpaid') && !name.includes('fastag') && !name.includes('ugvcl') && !name.includes('broadband') && !name.includes('dth');
        })
        .map((b: any) => ({
          biller_id: b.biller_id,
          biller_name: b.biller_name,
          category: b.category,
          metadata: b.metadata || {},
          is_enabled: b.metadata?.is_enabled !== false // Default to true if not explicitly set to false
        }));

      setBillers(mapped);
      setInitialBillers(JSON.parse(JSON.stringify(mapped)));
      setHasChanges(false);
    } catch (err: any) {
      console.error('Error loading CC billers:', err);
      toast.error('Failed to load Credit Card billers');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (billerId: string) => {
    setBillers(prev => {
      const updated = prev.map(b => {
        if (b.biller_id === billerId) {
          return { ...b, is_enabled: !b.is_enabled };
        }
        return b;
      });
      checkChanges(updated);
      return updated;
    });
  };

  const handleBulkToggle = (status: boolean) => {
    setBillers(prev => {
      const updated = prev.map(b => ({ ...b, is_enabled: status }));
      checkChanges(updated);
      return updated;
    });
  };

  const checkChanges = (current: CCBillerItem[]) => {
    const isDifferent = current.some(item => {
      const orig = initialBillers.find(o => o.biller_id === item.biller_id);
      return !orig || orig.is_enabled !== item.is_enabled;
    });
    setHasChanges(isDifferent);
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      const changedItems = billers.filter(item => {
        const orig = initialBillers.find(o => o.biller_id === item.biller_id);
        return !orig || orig.is_enabled !== item.is_enabled;
      });

      if (changedItems.length === 0) {
        toast.info('No changes to save.');
        setSaving(false);
        return;
      }

      // Batch update metadata for changed billers
      for (const item of changedItems) {
        const updatedMetadata = {
          ...(item.metadata || {}),
          is_enabled: item.is_enabled
        };

        const { error } = await supabase
          .from('billavenue_billers')
          .update({ metadata: updatedMetadata })
          .eq('biller_id', item.biller_id);

        if (error) {
          console.error(`Failed to update ${item.biller_name}:`, error);
          throw error;
        }
      }

      toast.success(`Successfully updated ${changedItems.length} Credit Card biller(s)!`);
      setInitialBillers(JSON.parse(JSON.stringify(billers)));
      setHasChanges(false);
    } catch (err: any) {
      console.error('Error saving CC biller settings:', err);
      toast.error('Failed to save biller toggle settings');
    } finally {
      setSaving(false);
    }
  };

  const filteredBillers = billers.filter(b => {
    const matchesSearch = b.biller_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          b.biller_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || 
                          (filterStatus === 'enabled' && b.is_enabled) || 
                          (filterStatus === 'disabled' && !b.is_enabled);
    return matchesSearch && matchesStatus;
  });

  const enabledCount = billers.filter(b => b.is_enabled).length;
  const disabledCount = billers.filter(b => !b.is_enabled).length;

  return (
    <div className="space-y-6 max-w-[1500px] mx-auto p-4 select-none">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 rounded-[32px] border border-slate-700/50 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 space-y-2">
          <span className="text-xs bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full font-bold uppercase tracking-widest flex items-center gap-1.5 w-fit">
            <Sparkles size={12} className="animate-spin-slow" />
            System Management
          </span>
          <div className="flex items-center gap-3">
            <CreditCard className="text-indigo-400" size={32} />
            <h2 className="text-3xl font-black text-white tracking-tight">
              CC Biller Toggle Management
            </h2>
          </div>
          <p className="text-slate-400 max-w-xl text-sm leading-relaxed">
            Turn specific Credit Card billers ON or OFF. Only enabled billers will be visible to users in real-time.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="relative z-10 flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleBulkToggle(true)}
            className="px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 size={15} />
            Enable All ({billers.length})
          </button>
          <button
            onClick={() => handleBulkToggle(false)}
            className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <XCircle size={15} />
            Disable All
          </button>
          <button
            onClick={handleSaveChanges}
            disabled={!hasChanges || saving}
            className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg cursor-pointer ${
              hasChanges 
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 animate-pulse'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filter and Stats Toolbar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full sm:w-96">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by biller name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-xs font-bold text-slate-800 focus:border-indigo-500 focus:bg-white transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              filterStatus === 'all'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({billers.length})
          </button>
          <button
            onClick={() => setFilterStatus('enabled')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              filterStatus === 'enabled'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            Enabled ({enabledCount})
          </button>
          <button
            onClick={() => setFilterStatus('disabled')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              filterStatus === 'disabled'
                ? 'bg-rose-600 text-white shadow-md'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            Disabled ({disabledCount})
          </button>
        </div>
      </div>

      {/* Biller Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 bg-white rounded-3xl border border-slate-200">
          <RefreshCw size={32} className="text-indigo-600 animate-spin" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">
            Loading Credit Card Billers...
          </p>
        </div>
      ) : filteredBillers.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200 space-y-3">
          <HelpCircle size={36} className="mx-auto text-slate-300" />
          <p className="text-sm font-black text-slate-600">No Credit Card Billers Found</p>
          <p className="text-xs text-slate-400">No billers matching search or filter criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {filteredBillers.map((biller) => {
            const logoUrl = getBankLogoUrl(biller.biller_name);
            const initials = (biller.biller_name || 'UB').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

            return (
              <div
                key={biller.biller_id}
                onClick={() => handleToggle(biller.biller_id)}
                className={`group relative bg-white border transition-all duration-200 rounded-2xl p-4 shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between overflow-hidden ${
                  biller.is_enabled 
                    ? 'border-emerald-200/80 hover:border-emerald-400 bg-emerald-50/10' 
                    : 'border-slate-200/80 opacity-60 hover:opacity-100 bg-slate-50/50'
                }`}
              >
                {/* Status Indicator Bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${biller.is_enabled ? 'bg-emerald-500' : 'bg-rose-400'}`}></div>

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-sm">
                    {logoUrl ? (
                      <img src={logoUrl} alt={biller.biller_name} className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-black text-xs flex items-center justify-center">
                        {initials}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-slate-800 text-xs line-clamp-2 leading-snug" title={biller.biller_name}>
                      {biller.biller_name}
                    </h4>
                    <p className="text-[9px] font-mono text-slate-400 mt-0.5 truncate">{biller.biller_id}</p>
                  </div>
                </div>

                {/* Toggle Footer */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-2">
                  <span className={`text-[10px] font-black uppercase tracking-wider ${
                    biller.is_enabled ? 'text-emerald-600' : 'text-slate-400'
                  }`}>
                    {biller.is_enabled ? 'Active' : 'Disabled'}
                  </span>
                  <div className="cursor-pointer transition-transform group-hover:scale-110">
                    {biller.is_enabled ? (
                      <ToggleRight size={26} className="text-emerald-600 fill-emerald-100" />
                    ) : (
                      <ToggleLeft size={26} className="text-slate-300" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
