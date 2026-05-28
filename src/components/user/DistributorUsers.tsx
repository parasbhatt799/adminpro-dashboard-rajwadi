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
  FileText,
  Users,
  LayoutGrid,
  Ban,
  CheckCircle,
  Clock
} from 'lucide-react';
import { LogoLoader } from '../shared/LoadingSpinner';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
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

  const [currentUserRole, setCurrentUserRole] = useState<string>('distributor');

  // Super Distributor specific states
  const [selectedDistributor, setSelectedDistributor] = useState<any>(null);
  const [subUsers, setSubUsers] = useState<any[]>([]);
  const [loadingSubUsers, setLoadingSubUsers] = useState(false);
  const [subSearchTerm, setSubSearchTerm] = useState('');
  const [subStatusFilter, setSubStatusFilter] = useState('All');
  const [subPageSize, setSubPageSize] = useState(10);

  const fetchUsers = async (roleOverride?: string) => {
    setLoading(true);
    try {
      const activeRole = roleOverride || currentUserRole;
      let query = supabase
        .from('users_profiles')
        .select('*, sub_count:users_profiles!distributor_id(count)');

      if (activeRole === 'super_distributor') {
        query = query.eq('super_distributor_id', userId);
      } else {
        query = query.eq('distributor_id', userId);
      }

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

  const fetchSubUsers = async (distId: string) => {
    setLoadingSubUsers(true);
    try {
      const { data, error } = await supabase
        .from('users_profiles')
        .select('*')
        .eq('distributor_id', distId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubUsers(data || []);
    } catch (err) {
      console.error('Error fetching sub-users:', err);
    } finally {
      setLoadingSubUsers(false);
    }
  };

  const toggleBlockStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Suspended' ? 'Active' : 'Suspended';

    // Optimistic update
    setSubUsers(prev => prev.map(user =>
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
      if (selectedDistributor) fetchSubUsers(selectedDistributor.id);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { data, error } = await supabase
          .from('users_profiles')
          .select('admin_base_qr_charge, role')
          .eq('id', userId)
          .single();

        if (error) throw error;
        const role = data?.role || 'distributor';
        const charge = Number(data?.admin_base_qr_charge) || 0;
        setDistributorBaseCharge(charge);
        setCurrentUserRole(role);

        fetchUsers(role);
      } catch (err) {
        console.error('Error initializing DistributorUsers:', err);
        fetchUsers();
      }
    };

    init();
  }, [userId, searchTerm]);

  const isSD = currentUserRole === 'super_distributor';

  const filteredSubUsers = subUsers.filter(u => {
    const matchesSearch =
      u.name.toLowerCase().includes(subSearchTerm.toLowerCase()) ||
      u.firm_name?.toLowerCase().includes(subSearchTerm.toLowerCase()) ||
      u.mobile_number.includes(subSearchTerm) ||
      u.id.toLowerCase().includes(subSearchTerm.toLowerCase());

    const matchesStatus = subStatusFilter === 'All' || u.status === subStatusFilter;

    return matchesSearch && matchesStatus;
  }).slice(0, subPageSize);

  if (isAddingUser || editingUser) {
    return (
      <AddUser
        isDistributorView={!isSD}
        distributorBaseCharge={!isSD ? distributorBaseCharge : 0}
        isSuperDistributorView={isSD}
        superDistributorBaseCharge={isSD ? distributorBaseCharge : 0}
        initialData={editingUser
          ? (isSD ? { ...editingUser, super_distributor_id: userId } : { ...editingUser, distributor_id: userId })
          : (isSD ? { super_distributor_id: userId, role: 'distributor' } : { distributor_id: userId, role: 'user' })}
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

  if (viewingStatementUserId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setViewingStatementUserId(null)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">User Statement</h2>
            <p className="text-sm text-slate-500 font-medium">
              Viewing history for: <span className="text-indigo-600 font-bold">{users.find(u => u.id === viewingStatementUserId)?.firm_name || users.find(u => u.id === viewingStatementUserId)?.name}</span>
            </p>
          </div>
        </div>
        <UserStatementReport userId={viewingStatementUserId} />
      </div>
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

  // If a Super Distributor is viewing sub-users of a distributor
  if (isSD && selectedDistributor) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedDistributor(null)}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{selectedDistributor.firm_name || selectedDistributor.name}</h2>
            <p className="text-slate-500 text-sm">Managed by {selectedDistributor.name} • {subUsers.length} Sub-users</p>
          </div>
        </div>

        {/* Filters and Search for Sub-Users */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
          <div className="flex items-center gap-2 text-sm text-slate-500 min-w-max border-r border-slate-100 pr-4 mr-2">
            <span className="font-medium">Show</span>
            <select
              value={subPageSize}
              onChange={(e) => setSubPageSize(Number(e.target.value))}
              className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="font-medium">entries</span>
          </div>
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={subSearchTerm}
              onChange={(e) => setSubSearchTerm(e.target.value)}
              placeholder="Search users by name, firm, mobile or ID..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={subStatusFilter}
              onChange={(e) => setSubStatusFilter(e.target.value)}
              className="flex-1 md:flex-none px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer"
            >
              <option value="All">All Status</option>
              <option value="Active">Active Only</option>
              <option value="Suspended">Suspended Only</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Users size={20} className="text-emerald-600" />
              Sub-Users List
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-[11px] font-black text-slate-600 uppercase tracking-widest">User Details</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-600 uppercase tracking-widest">Firm Name</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-600 uppercase tracking-widest">Contact</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-600 uppercase tracking-widest">Wallet Balance</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-600 uppercase tracking-widest">Hold Balance</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-600 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-600 uppercase tracking-widest text-center">KYC</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-600 uppercase tracking-widest">Joined Date</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-600 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loadingSubUsers ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-20 text-center">
                      <LogoLoader size="md" className="mx-auto" />
                    </td>
                  </tr>
                ) : filteredSubUsers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-20 text-center text-slate-400">
                      No users found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredSubUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50 transition-colors group cursor-pointer"
                      onClick={() => setSelectedUser(user)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold text-sm border border-emerald-100 group-hover:scale-110 transition-transform overflow-hidden">
                            {user.profile_photo_url ? (
                              <img src={user.profile_photo_url} alt="" className="w-full h-full object-cover" />
                            ) : user.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900 leading-none">{user.name}</p>
                            <p className="text-[10px] font-medium text-slate-400 mt-1.5 flex items-center gap-1">
                              <Shield size={12} />
                              ID: {user.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Building2 size={16} className="text-slate-400" />
                          <span className="text-xs font-medium text-slate-700 truncate max-w-[150px]">{user.firm_name || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <Mail size={12} className="text-slate-400" />
                            {user.email}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <Phone size={12} className="text-slate-400" />
                            {user.mobile_number}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg w-fit">
                          <IndianRupee size={12} />
                          {Number(user.wallet_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg w-fit">
                          <IndianRupee size={12} />
                          {Number(user.hold_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className={`w-fit px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${user.status === 'Active' ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'
                            }`}>
                            {user.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          {user.kyc_status === 'verified' ? (
                            <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                              <CheckCircle size={10} />
                              Verified
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-100">
                              <Clock size={10} />
                              Pending
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Calendar size={14} />
                          {user.created_at ? format(new Date(user.created_at), 'd/M/yyyy') : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              toggleBlockStatus(user.id, user.status);
                            }}
                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-rose-500 transition-all"
                            title={user.status === 'Suspended' ? 'Unblock User' : 'Block User'}
                          >
                            <Ban size={16} />
                          </button>
                          <button
                            onClick={() => setSelectedUser(user)}
                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-emerald-500 transition-all"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Super Distributor Card Grid Layout
  if (isSD) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">My Distributors</h2>
            <p className="text-slate-500 mt-1">Manage distributors you have registered in the system.</p>
          </div>
          <button
            onClick={() => setIsAddingUser(true)}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-200 active:scale-95"
          >
            <UserPlus size={20} />
            <span>Add New Distributor</span>
          </button>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search your distributors..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full py-20 text-center">
              <LogoLoader size="md" className="mx-auto" />
            </div>
          ) : users.length === 0 ? (
            <div className="col-span-full py-20 text-center text-slate-400">
              No distributors found.
            </div>
          ) : (
            users.map((dist) => (
              <motion.div
                key={dist.id}
                layoutId={dist.id}
                className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-xl hover:shadow-emerald-500/5 transition-all group border-b-4 border-b-emerald-500 relative"
              >
                {/* Badges in Top Right */}
                <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-1.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-emerald-600 text-white shadow-lg shadow-emerald-200">
                    Distributor
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60 shadow-sm">
                    Super Dist: Me
                  </span>
                </div>

                <div className="p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform overflow-hidden">
                      {dist.profile_photo_url ? (
                        <img src={dist.profile_photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Building2 size={28} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 truncate pr-20">{dist.firm_name || dist.name}</h3>
                      <p className="text-xs text-slate-400 truncate">{dist.email}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-slate-50 p-3 rounded-2xl">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Sub-Users</p>
                      <div className="flex items-center gap-2 font-bold text-slate-700">
                        <Users size={14} className="text-emerald-500" />
                        <span>{dist.sub_count?.[0]?.count || 0}</span>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Commission</p>
                      <div className="flex items-center gap-2 font-bold text-slate-700">
                        <IndianRupee size={14} className="text-emerald-500" />
                        <span>{Number(dist.commission_balance || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setSelectedUser(dist)}
                      className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 group/prof"
                    >
                      <UserIcon size={18} className="group-hover/prof:scale-110 transition-transform" />
                      Profile
                    </button>
                    <button
                      onClick={() => {
                        setSelectedDistributor(dist);
                        fetchSubUsers(dist.id);
                      }}
                      className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 group/btn shadow-lg shadow-emerald-100"
                    >
                      <LayoutGrid size={18} className="group-hover/btn:rotate-90 transition-transform duration-500" />
                      Manage Users
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    );
  }

  // Default Normal Distributor List Layout
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
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <LogoLoader size="md" />
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
