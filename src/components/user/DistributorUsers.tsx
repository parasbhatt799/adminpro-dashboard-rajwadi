import { 
  Search, 
  UserPlus, 
  Mail,
  Phone,
  Calendar,
  Shield,
  Loader2,
  User as UserIcon,
  Building2,
  IndianRupee,
  ChevronRight,
  ArrowLeft,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import AddUser from '../AddUser';
import UserDetails from '../UserDetails';
import UserStatementReport from './UserStatementReport';

interface DistributorUsersProps {
  userId: string;
}

export default function DistributorUsers({ userId }: DistributorUsersProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [viewingStatementUserId, setViewingStatementUserId] = useState<string | null>(null);
  const [distributorBaseCharge, setDistributorBaseCharge] = useState(0);

  const fetchDistributorProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('users_profiles')
        .select('admin_base_qr_charge')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      setDistributorBaseCharge(Number(data?.admin_base_qr_charge) || 0);
    } catch (err) {
      console.error('Error fetching distributor profile:', err);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('users_profiles')
        .select('*')
        .eq('distributor_id', userId);

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,mobile_number.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,id.ilike.%${searchTerm}%,firm_name.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching distributor users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchDistributorProfile();
  }, [userId, searchTerm]);

  if (isAddingUser || editingUser) {
    return (
      <AddUser 
        isDistributorView={true}
        distributorBaseCharge={distributorBaseCharge}
        initialData={editingUser ? { ...editingUser, distributor_id: userId } : { distributor_id: userId, role: 'user' }}
        onBack={() => {
          setIsAddingUser(false);
          setEditingUser(null);
        }}
        onSuccess={() => {
          setIsAddingUser(false);
          setEditingUser(null);
          fetchUsers();
        }}
      />
    );
  }

  if (selectedUser) {
    return (
      <UserDetails 
        isDistributorView={true}
        user={selectedUser}
        onBack={() => setSelectedUser(null)}
        onEdit={(user) => setEditingUser(user)}
        onDelete={() => {
          // Distributors cannot delete users
          alert("Only Admin can delete users.");
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">My Users</h2>
          <p className="text-slate-500 mt-1">Manage users you have registered in the system.</p>
        </div>
        <button 
          onClick={() => setIsAddingUser(true)}
          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-200 active:scale-95"
        >
          <UserPlus size={20} />
          <span>Add New User</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search your users..." 
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-h-[400px] flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="animate-spin text-emerald-500" size={32} />
            <p className="text-sm font-medium">Loading your users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4 p-12">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
              <UserIcon size={32} className="text-slate-300" />
            </div>
            <div className="text-center">
              <p className="text-slate-900 font-bold">No users found</p>
              <p className="text-sm mt-1">You haven't added any users yet.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-[11px] font-black text-slate-600 uppercase tracking-widest">User Details</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-600 uppercase tracking-widest">Firm Name</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-600 uppercase tracking-widest text-center">KYC Status</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-600 uppercase tracking-widest text-center">Reports</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-600 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map((user, i) => (
                  <tr 
                    key={user.id} 
                    onClick={() => setSelectedUser(user)}
                    className="hover:bg-slate-50 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold text-sm border border-emerald-100">
                          {user.profile_photo_url ? (
                            <img src={user.profile_photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            user.name.charAt(0)
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{user.name}</p>
                          <p className="text-[10px] text-slate-400 font-medium">ID: {user.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-slate-400" />
                        <span className="text-sm text-slate-700">{user.firm_name || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${user.kyc_status === 'verified' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <span className={`text-[10px] font-bold uppercase ${user.kyc_status === 'verified' ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {user.kyc_status === 'verified' ? 'Verified' : 'Pending'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => setViewingStatementUserId(user.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-indigo-100 transition-colors"
                      >
                        <FileText size={14} />
                        Statement
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-slate-400 hover:text-emerald-600 transition-colors">
                        <ChevronRight size={20} />
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
