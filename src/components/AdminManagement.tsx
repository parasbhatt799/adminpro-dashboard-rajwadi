import React, { useState, useEffect } from 'react';
import { UserPlus, Shield, Trash2, Loader2, X, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';

export default function AdminManagement() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const [error, setError] = useState('');
  
  // New Admin Form
  const [newAdminMobile, setNewAdminMobile] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'full' | 'limited'>('full');
  const [addLoading, setAddLoading] = useState(false);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const { data, error: dbError } = await supabase
        .from('admin_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (dbError) throw dbError;
      setAdmins(data || []);
    } catch (err: any) {
      console.error('Error fetching admins:', err);
      setError('Failed to load administrators');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    setError('');

    try {
      // 1. Create in Supabase Auth via Backend
      const response = await fetch('/api/manage-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          mobileNumber: newAdminMobile,
          password: newAdminPassword,
          role: newAdminRole
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create admin in Auth');

      // 2. Create or Update in admin_profiles table
      const { error: dbError } = await supabase
        .from('admin_profiles')
        .upsert([{ 
          mobile_number: newAdminMobile, 
          password: newAdminPassword,
          role: newAdminRole
        }], { onConflict: 'mobile_number' });

      if (dbError) throw dbError;

      setIsAddingAdmin(false);
      setNewAdminMobile('');
      setNewAdminPassword('');
      setNewAdminRole('full');
      fetchAdmins();
      alert('Administrator added successfully!');
    } catch (err: any) {
      console.error('Add admin error:', err);
      setError(err.message || 'Failed to add administrator');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteAdmin = async (mobileNumber: string) => {
    if (!confirm(`Are you sure you want to remove admin ${mobileNumber}? This will revoke their access immediately.`)) return;

    try {
      // 1. Remove from Auth via Backend
      const response = await fetch('/api/manage-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          mobileNumber: mobileNumber
        })
      });

      if (!response.ok) {
        const result = await response.json();
        console.warn('Auth deletion warning:', result.error);
      }

      // 2. Remove from admin_profiles table
      const { error: dbError } = await supabase
        .from('admin_profiles')
        .delete()
        .eq('mobile_number', mobileNumber);

      if (dbError) throw dbError;
      fetchAdmins();
      alert('Administrator removed successfully.');
    } catch (err: any) {
      console.error('Delete admin error:', err);
      setError('Failed to delete administrator');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Admin Management</h2>
          <p className="text-slate-500 mt-1">Manage portal administrators and their access credentials.</p>
        </div>
        <button 
          onClick={() => setIsAddingAdmin(true)}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95"
        >
          <UserPlus size={20} />
          <span>Add Admin</span>
        </button>
      </div>

      <AnimatePresence>
        {isAddingAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingAdmin(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md relative z-10 bg-white rounded-3xl shadow-2xl p-8 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                    <Shield size={20} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Add New Admin</h3>
                </div>
                <button onClick={() => setIsAddingAdmin(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold">
                  {error}
                </div>
              )}

              <form onSubmit={handleAddAdmin} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Mobile Number</label>
                  <input
                    required
                    type="tel"
                    value={newAdminMobile}
                    onChange={(e) => setNewAdminMobile(e.target.value)}
                    placeholder="Enter admin mobile number"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Secure Password</label>
                  <input
                    required
                    type="password"
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder="Create secure password"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1">Access Level</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setNewAdminRole('full')}
                      className={`p-4 rounded-2xl border-2 transition-all text-left ${
                        newAdminRole === 'full' 
                          ? 'border-indigo-600 bg-indigo-50/50' 
                          : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                      }`}
                    >
                      <Shield className={`mb-2 ${newAdminRole === 'full' ? 'text-indigo-600' : 'text-slate-400'}`} size={20} />
                      <p className={`text-sm font-bold ${newAdminRole === 'full' ? 'text-indigo-900' : 'text-slate-600'}`}>Full Admin</p>
                      <p className="text-[10px] text-slate-500 mt-1">Total control over everything.</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewAdminRole('limited')}
                      className={`p-4 rounded-2xl border-2 transition-all text-left ${
                        newAdminRole === 'limited' 
                          ? 'border-indigo-600 bg-indigo-50/50' 
                          : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                      }`}
                    >
                      <div className={`mb-2 w-5 h-5 rounded-md flex items-center justify-center ${newAdminRole === 'limited' ? 'bg-indigo-600 text-white' : 'bg-slate-300 text-white'}`}>
                        <X size={14} />
                      </div>
                      <p className={`text-sm font-bold ${newAdminRole === 'limited' ? 'text-indigo-900' : 'text-slate-600'}`}>Limited Admin</p>
                      <p className="text-[10px] text-slate-500 mt-1">Cannot manage admins or change passwords.</p>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={addLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98] disabled:opacity-50"
                >
                  {addLoading ? <Loader2 className="animate-spin" size={20} /> : <UserPlus size={20} />}
                  {addLoading ? 'Creating Authorized User...' : 'Add Administrator'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
            <p className="text-sm font-medium">Verifying authorization levels...</p>
          </div>
        ) : admins.length === 0 ? (
          <div className="p-20 text-center">
            <p className="text-slate-900 font-bold">No other admins found</p>
            <p className="text-slate-500 text-sm mt-1">You can add additional portal managers using the button above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Administrator</th>
                  <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Access Level</th>
                  <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Added On</th>
                  <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Security</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {admins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold border border-indigo-200">
                          <Shield size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 leading-none">{admin.mobile_number}</p>
                          <p className="text-[10px] text-emerald-500 font-black uppercase mt-1.5 flex items-center gap-1">
                            <CheckCircle size={10} /> Verified Access
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        admin.role === 'full' 
                          ? 'bg-indigo-100 text-indigo-600' 
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {admin.role === 'limited' ? 'Limited Admin' : 'Full Administrator'}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-xs text-slate-500 font-medium">
                        {new Date(admin.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button 
                        onClick={() => handleDeleteAdmin(admin.mobile_number)}
                        className="p-2 text-slate-300 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        title="Revoke Admin Access"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
