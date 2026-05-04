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
  Building2,
  IndianRupee
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, type MouseEvent, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import UserDetails from './UserDetails';
import AddUser from './AddUser';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface UsersListProps {
  adminRole?: string;
}

export default function UsersList({ adminRole }: UsersListProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const targetUserId = searchParams.get('id');

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  // ... existing states

  // Effect to handle direct user selection from URL
  useEffect(() => {
    if (targetUserId) {
      const fetchTargetUser = async () => {
        const { data, error } = await supabase
          .from('users_profiles')
          .select('*')
          .eq('id', targetUserId)
          .single();
        
        if (data && !error) {
          setSelectedUser(data);
        }
      };
      fetchTargetUser();
    }
  }, [targetUserId]);

  // Advanced States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [pageSize, setPageSize] = useState(10);

  const fetchUsers = async (isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true);
    else {
      setLoading(true);
      setPage(0);
    }

    try {
      const currentPage = isLoadMore ? page + 1 : 0;
      let query = supabase
        .from('users_profiles')
        .select('*', { count: 'exact' });

      // Search Filter
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,mobile_number.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,id.ilike.%${searchTerm}%,firm_name.ilike.%${searchTerm}%`);
      }

      // Role/Status Filter
      if (statusFilter === 'distributor') {
        query = query.eq('role', 'distributor');
      } else if (statusFilter !== 'All') {
        query = query.eq('status', statusFilter);
      }

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);

      if (error) throw error;

      if (isLoadMore) {
        setUsers(prev => [...prev, ...(data || [])]);
        setPage(currentPage);
      } else {
        setUsers(data || []);
      }

      setHasMore(count ? (isLoadMore ? users.length + (data?.length || 0) : (data?.length || 0)) < count : false);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter, pageSize]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('users_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'users_profiles'
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setUsers(prev => [payload.new, ...prev].slice(0, pageSize));
        } else if (payload.eventType === 'UPDATE') {
          setUsers(prev => prev.map(u => u.id === payload.new.id ? payload.new : u));
        } else if (payload.eventType === 'DELETE') {
          setUsers(prev => prev.filter(u => u.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pageSize]);

  const handleExportExcel = async () => {
    try {
      setLoading(true);
      const fetchAll = async (query: any) => {
        let allData: any[] = [];
        let from = 0;
        const step = 1000;
        while (true) {
          const { data, error } = await query.range(from, from + step - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          allData = [...allData, ...data];
          if (data.length < step) break;
          from += step;
        }
        return allData;
      };

      let query = supabase
        .from('users_profiles')
        .select('*');

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,mobile_number.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,id.ilike.%${searchTerm}%`);
      }
      if (statusFilter !== 'All') {
        if (statusFilter === 'distributor') {
          query = query.eq('role', 'distributor');
        } else {
          query = query.eq('status', statusFilter);
        }
      }

      const data = await fetchAll(query.order('created_at', { ascending: false }));

      const exportData = data.map(u => ({
        'Join Date': format(new Date(u.created_at), 'dd-MM-yyyy'),
        'User Name': u.name,
        'Firm Name': u.firm_name || 'N/A',
        'Mobile': u.mobile_number,
        'Email': u.email,
        'Role': u.role,
        'Wallet Balance': Number(u.wallet_balance || 0),
        'Hold Balance': Number(u.hold_balance || 0),
        'Status': u.status,
        'KYC Status': u.kyc_status === 'verified' ? 'VERIFIED' : 'NOT VERIFIED',
        'User ID': u.id
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Users');
      XLSX.writeFile(wb, `Users_Report_${format(new Date(), 'ddMMyyyy_HHmm')}.xlsx`);
    } catch (err) {
      console.error('Excel Export Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setLoading(true);
      const fetchAll = async (query: any) => {
        let allData: any[] = [];
        let from = 0;
        const step = 1000;
        while (true) {
          const { data, error } = await query.range(from, from + step - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          allData = [...allData, ...data];
          if (data.length < step) break;
          from += step;
        }
        return allData;
      };

      let query = supabase
        .from('users_profiles')
        .select('*');

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,mobile_number.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,id.ilike.%${searchTerm}%`);
      }
      if (statusFilter !== 'All') {
        if (statusFilter === 'distributor') {
          query = query.eq('role', 'distributor');
        } else {
          query = query.eq('status', statusFilter);
        }
      }

      const data = await fetchAll(query.order('created_at', { ascending: false }));
      if (!data || data.length === 0) {
        alert('No users found to export');
        return;
      }

      const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });

      doc.setFontSize(20);
      doc.setTextColor(79, 70, 229);
      doc.text('USEPAY PORTAL - USERS REPORT', 14, 22);

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated on: ${format(new Date(), 'dd MMMM yyyy, HH:mm')}`, 14, 30);
      doc.text(`Filter: ${statusFilter} | Search: ${searchTerm || 'None'}`, 14, 35);

      const tableData = data.map((u, i) => [
        String(i + 1),
        u.created_at ? format(new Date(u.created_at), 'dd-MM-yyyy') : 'N/A',
        String(u.name || ''),
        String(u.firm_name || 'N/A'),
        String(u.mobile_number || ''),
        String(u.email || ''),
        u.wallet_balance ? `Rs. ${Number(u.wallet_balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '0.00',
        u.hold_balance ? `Rs. ${Number(u.hold_balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '0.00',
        String(u.status || ''),
        u.kyc_status === 'verified' ? 'VERIFIED' : 'NOT VERIFIED'
      ]);

      autoTable(doc, {
        startY: 40,
        head: [['#', 'Join Date', 'Name', 'Firm Name', 'Mobile', 'Email', 'Wallet', 'Hold', 'Status', 'KYC']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 3 },
        alternateRowStyles: { fillColor: [249, 250, 251] }
      });

      doc.save(`Users_Report_${format(new Date(), 'ddMMyyyy')}.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
      alert('Failed to generate PDF. Please try again.');
    }
  };

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
        <div className="flex items-center gap-2 text-sm text-slate-500 min-w-max border-r border-slate-100 pr-4 mr-2">
          <span className="font-medium">Show</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
            className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
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
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search users by name, firm name, email, mobile or ID..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 md:flex-none px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer"
          >
            <option value="All">All Status</option>
            <option value="Active">Active Only</option>
            <option value="Suspended">Suspended Only</option>
            <option value="distributor">Distributors</option>
          </select>
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Download size={18} />
            <span>Excel</span>
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-100 bg-indigo-50 rounded-xl text-sm font-bold text-indigo-600 hover:bg-indigo-100 transition-colors"
          >
            <Download size={18} />
            <span>PDF</span>
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
                  <th className="px-2 py-4 text-[11px] font-black text-slate-600 uppercase tracking-widest">User Details</th>
                  <th className="px-2 py-4 text-[11px] font-black text-slate-600 uppercase tracking-widest">Firm Name</th>
                  <th className="px-2 py-4 text-[11px] font-black text-slate-600 uppercase tracking-widest">Contact</th>
                  <th className="px-2 py-4 text-[11px] font-black text-slate-600 uppercase tracking-widest">Wallet Balance</th>
                  <th className="px-2 py-4 text-[11px] font-black text-slate-600 uppercase tracking-widest">Hold Balance</th>
                  <th className="px-2 py-4 text-[11px] font-black text-slate-600 uppercase tracking-widest">Status</th>
                  <th className="px-2 py-4 text-[11px] font-black text-slate-600 uppercase tracking-widest text-center">KYC</th>
                  <th className="px-2 py-4 text-[11px] font-black text-slate-600 uppercase tracking-widest">Joined Date</th>
                  <th className="px-2 py-4 text-[11px] font-black text-slate-600 uppercase tracking-widest text-right">Actions</th>
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
                    <td className="px-2 py-4">
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
                            <p className="text-xs font-bold text-slate-900 leading-none truncate max-w-[120px]">{user.name}</p>
                            <ChevronRight size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                          </div>
                          <p className="text-[10px] font-medium text-slate-400 mt-1.5 flex items-center gap-1">
                            <Shield size={12} />
                            ID: {user.id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-4">
                      <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-slate-400" />
                        <span className="text-xs font-medium text-slate-700 truncate max-w-[150px]">{user.firm_name || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-2 py-4">
                      <div className="space-y-1.5">
                        <p className="text-[12px] text-slate-900 flex items-center gap-2 truncate max-w-[180px]">
                          <Mail size={12} className="text-slate-400" />
                          {user.email}
                        </p>
                        <p className="text-[12px] text-slate-700 flex items-center gap-2">
                          <Phone size={12} className="text-slate-400" />
                          {user.mobile_number}
                        </p>
                      </div>
                    </td>
                    <td className="px-2 py-4">
                      <div className="flex items-center gap-2 text-[12px] text-indigo-600 font-bold">
                        <IndianRupee size={12} />
                        <span>{Number(user.wallet_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </td>
                    <td className="px-2 py-4">
                      <div className="flex items-center gap-2 text-[12px] text-amber-600 font-bold">
                        <IndianRupee size={12} />
                        <span>{Number(user.hold_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </td>
                    <td className="px-2 py-4">
                      <span className={`inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${user.status === 'Active' ? 'text-emerald-600 bg-emerald-50' :
                          user.status === 'Suspended' ? 'text-rose-600 bg-rose-50' :
                            'text-amber-600 bg-amber-50'
                        }`}>
                        {user.status}
                      </span>
                      {user.role === 'distributor' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-indigo-600 text-white shadow-sm shadow-indigo-200 ml-1">
                          Distributor
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full shadow-sm ${user.kyc_status === 'verified' ? 'bg-emerald-500 shadow-emerald-200 animate-pulse' : 'bg-amber-500 shadow-amber-200'
                          }`} />
                        <span className={`text-[8px] font-bold uppercase tracking-wider ${user.kyc_status === 'verified' ? 'text-emerald-600' : 'text-amber-600'
                          }`}>
                          {user.kyc_status === 'verified' ? 'Verified' : 'Not Verified'}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-4">
                      <p className="text-[12px] text-slate-500 flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400" />
                        {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-2 py-4 text-right">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={(e) => toggleBlockStatus(e, user.id, user.status)}
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
                          style={{ backgroundColor: user.status === 'Suspended' ? '#e2e8f0' : '#4f46e5' }}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${user.status === 'Suspended' ? 'translate-x-1' : 'translate-x-6'
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
            {hasMore ? (
              <button
                onClick={() => fetchUsers(true)}
                disabled={loadingMore}
                className="flex items-center gap-2 px-6 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                {loadingMore ? <Loader2 size={14} className="animate-spin" /> : null}
                {loadingMore ? 'Loading...' : 'Load More Users'}
              </button>
            ) : (
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">End of list</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
