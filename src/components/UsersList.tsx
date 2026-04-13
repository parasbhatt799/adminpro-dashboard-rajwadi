import { 
  Search, 
  UserPlus, 
  Filter,
  Download,
  Mail,
  Phone,
  Calendar,
  Shield,
  Ban,
  CheckCircle,
  ChevronRight,
  Loader2,
  User as UserIcon,
  IndianRupee
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, type MouseEvent, useEffect } from 'react';
import UserDetails from './UserDetails';
import AddUser from './AddUser';
import { supabase } from '../lib/supabase';

export default function UsersList() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const toggleBlockStatus = async (e: MouseEvent, userId: string, currentStatus: string) => {
    e.stopPropagation();
    const newStatus = currentStatus === 'Suspended' ? 'Active' : 'Suspended';
    
    // Optimistic update
    setUsers(prev => prev.map(user => 
      user.id === userId ? { ...user, status: newStatus } : user
    ));

    try {
      const { error } = await supabase
        .from('users_profiles')
        .update({ status: newStatus })
        .eq('id', userId);

      if (error) throw error;
    } catch (err) {
      console.error('Error updating status:', err);
      // Revert on error
      fetchUsers();
    }
  };

  if (isAddingUser || editingUser) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <AddUser 
          initialData={editingUser}
          onBack={() => {
            setIsAddingUser(false);
            setEditingUser(null);
          }} 
          onSuccess={() => {
            setIsAddingUser(false);
            setEditingUser(null);
            fetchUsers();
            // If we were editing, refresh the selected user data
            if (editingUser) {
              const refreshSelected = async () => {
                const { data } = await supabase
                  .from('users_profiles')
                  .select('*')
                  .eq('id', editingUser.id)
                  .single();
                if (data) setSelectedUser(data);
              };
              refreshSelected();
            } else {
              setSelectedUser(null);
            }
          }} 
        />
      </motion.div>
    );
  }

  if (selectedUser) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
      >
        <UserDetails 
          user={selectedUser} 
          onBack={() => setSelectedUser(null)} 
          onEdit={(user) => setEditingUser(user)}
          onDelete={() => {
            const deletedId = selectedUser.id;
            setSelectedUser(null);
            setUsers(prev => prev.filter(u => u.id !== deletedId));
            fetchUsers();
          }}
        />
      </motion.div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Users List</h2>
          <p className="text-slate-500 mt-1">Manage and monitor all registered users in the system.</p>
        </div>
        <button 
          onClick={() => setIsAddingUser(true)}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95"
        >
          <UserPlus size={20} />
          <span>Add User</span>
        </button>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search users by name, email or ID..." 
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <Filter size={18} />
            <span>Filters</span>
          </button>
          <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <Download size={18} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-h-[400px] flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
            <p className="text-sm font-medium">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4 p-12">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
              <UserIcon size={32} className="text-slate-300" />
            </div>
            <div className="text-center">
              <p className="text-slate-900 font-bold">No users found</p>
              <p className="text-sm mt-1">Start by adding your first user to the system.</p>
            </div>
            <button 
              onClick={() => setIsAddingUser(true)}
              className="mt-2 text-indigo-600 font-bold text-sm hover:underline"
            >
              Add User Now
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">User Details</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Wallet Balance</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Joined Date</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map((user, i) => (
                  <motion.tr 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={user.id} 
                    onClick={() => setSelectedUser(user)}
                    className="hover:bg-slate-50 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm border border-indigo-100 group-hover:scale-110 transition-transform overflow-hidden">
                          {user.profile_photo_url ? (
                            <img src={user.profile_photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            user.name.charAt(0)
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-900 leading-none">{user.name}</p>
                            <ChevronRight size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                          </div>
                          <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
                            <Shield size={12} />
                            ID: {user.id.slice(0, 8)}...
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1.5">
                        <p className="text-xs text-slate-500 flex items-center gap-2">
                          <Mail size={14} className="text-slate-400" />
                          {user.email}
                        </p>
                        <p className="text-xs text-slate-500 flex items-center gap-2">
                          <Phone size={14} className="text-slate-400" />
                          {user.mobile_number}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-indigo-600 font-bold">
                        <IndianRupee size={14} />
                        <span>{Number(user.wallet_balance || 0).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        user.status === 'Active' ? 'text-emerald-600 bg-emerald-50' : 
                        user.status === 'Suspended' ? 'text-rose-600 bg-rose-50' : 
                        'text-amber-600 bg-amber-50'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-slate-500 flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400" />
                        {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end">
                        <button 
                          onClick={(e) => toggleBlockStatus(e, user.id, user.status)}
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
                          style={{ backgroundColor: user.status === 'Suspended' ? '#e2e8f0' : '#4f46e5' }}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              user.status === 'Suspended' ? 'translate-x-1' : 'translate-x-6'
                            }`}
                          />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && users.length > 0 && (
          <div className="mt-auto p-4 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between">
            <p className="text-xs text-slate-500 font-medium">Showing {users.length} users</p>
            <div className="flex gap-2">
              <button className="px-3 py-1 text-xs font-bold text-slate-400 cursor-not-allowed">Previous</button>
              <button className="px-3 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
