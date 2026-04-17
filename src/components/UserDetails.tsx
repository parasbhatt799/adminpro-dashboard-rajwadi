import { 
  Loader2,
  ArrowLeft, 
  Mail, 
  Phone, 
  Calendar, 
  Building2, 
  Percent, 
  IndianRupee,
  FileText,
  Trash2,
  Edit3,
  AlertTriangle,
  X,
  MapPin,
  CreditCard,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface UserDetailsProps {
  user: any;
  onBack: () => void;
  onEdit: (user: any) => void;
  onDelete: () => void;
}

export default function UserDetails({ user, onBack, onEdit, onDelete }: UserDetailsProps) {
  const [activeTab, setActiveTab] = useState<'firm' | 'kyc'>('firm');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kycDocs, setKycDocs] = useState<any>(null);
  const [loadingKyc, setLoadingKyc] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{url: string, label: string} | null>(null);

  useEffect(() => {
    const fetchKycDocs = async () => {
      if (activeTab === 'kyc' && !kycDocs) {
        setLoadingKyc(true);
        try {
          const { data, error: kycError } = await supabase
            .from('kyc_submissions')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'approved')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (kycError) throw kycError;
          setKycDocs(data);
        } catch (err) {
          console.error('Error fetching KYC documents:', err);
        } finally {
          setLoadingKyc(false);
        }
      }
    };
    
    fetchKycDocs();
  }, [activeTab, user.id, kycDocs]);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      // 1. Identify files to delete from Storage
      const filesToDeleteFromProfiles: string[] = [];
      const filesToDeleteFromPayments: string[] = [];

      // Fetch KYC documents
      const { data: kycSubmissions } = await supabase
        .from('kyc_submissions')
        .select('*')
        .eq('user_id', user.id);

      kycSubmissions?.forEach(sub => {
        const docKeys = [
          'aadhaar_front_url', 
          'aadhaar_back_url', 
          'pan_card_url', 
          'cheque_photo_url', 
          'selfie_url', 
          'firm_photo_url'
        ];
        docKeys.forEach(key => {
          if (sub[key]) {
            const path = sub[key].split('profiles/')[1];
            if (path) filesToDeleteFromProfiles.push(path);
          }
        });
      });

      // Fetch Payment Proofs
      const { data: paymentSubmissions } = await supabase
        .from('payment_submissions')
        .select('proof_url')
        .eq('user_id', user.id);

      paymentSubmissions?.forEach(sub => {
        if (sub.proof_url) {
          const path = sub.proof_url.split('payment_proofs/')[1];
          if (path) filesToDeleteFromPayments.push(path);
        }
      });

      // Add profile photo if exists
      if (user.profile_photo_url) {
        const path = user.profile_photo_url.split('profiles/')[1];
        if (path) filesToDeleteFromProfiles.push(path);
      }

      // 2. Perform storage cleanup
      if (filesToDeleteFromProfiles.length > 0) {
        await supabase.storage.from('profiles').remove(filesToDeleteFromProfiles);
      }
      if (filesToDeleteFromPayments.length > 0) {
        await supabase.storage.from('payment_proofs').remove(filesToDeleteFromPayments);
      }

      // 3. Delete user record (triggering DB cascades)
      const { error: deleteError } = await supabase
        .from('users_profiles')
        .delete()
        .eq('id', user.id);

      if (deleteError) throw deleteError;
      onDelete();
    } catch (err: any) {
      console.error('Error during full user deletion:', err);
      setError(err.message || 'Failed to delete user and associated files.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download error:', err);
      window.open(url, '_blank');
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Full Screen Image Viewer Modal */}
      <AnimatePresence>
        {selectedImage && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center gap-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-full flex items-center justify-between text-white">
                <h3 className="text-lg font-bold">{selectedImage.label}</h3>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => handleDownload(selectedImage.url, `${selectedImage.label}.jpg`)}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    title="Download"
                  >
                    <Download size={20} />
                  </button>
                  <button 
                    onClick={() => setSelectedImage(null)}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>
              <div className="w-full h-full rounded-2xl overflow-hidden border border-white/10 bg-black flex items-center justify-center">
                <img 
                  src={selectedImage.url} 
                  alt={selectedImage.label} 
                  className="max-w-full max-h-full object-contain shadow-2xl" 
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100"
            >
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto mb-6">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 text-center mb-2">Confirm Delete</h3>
              <p className="text-slate-500 text-center mb-8">
                Are you sure you want to delete <strong>{user.name}</strong>? This action cannot be undone and all associated data will be lost.
              </p>
              {error && (
                <div className="mb-6 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-bold text-center">
                  {error}
                </div>
              )}
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-rose-200 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">User Profile</h2>
          <p className="text-slate-500 text-sm">Detailed information for {user.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 text-center">
            <div 
              className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold text-3xl border-4 border-white shadow-lg mx-auto mb-4 overflow-hidden cursor-zoom-in"
              onClick={() => user.profile_photo_url && setSelectedImage({url: user.profile_photo_url, label: user.name})}
            >
              {user.profile_photo_url ? (
                <img src={user.profile_photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                user.name.charAt(0)
              )}
            </div>
            <h3 className="text-xl font-bold text-slate-900">{user.name}</h3>
            
            <div className="mt-6 flex justify-center">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                user.status === 'Active' ? 'text-emerald-600 bg-emerald-50' : 
                user.status === 'Suspended' ? 'text-rose-600 bg-rose-50' : 
                'text-amber-600 bg-amber-50'
              }`}>
                {user.status}
              </span>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-50 space-y-4 text-left">
              <div className="flex items-center gap-3 text-slate-600">
                <Mail size={18} className="text-slate-400" />
                <span className="text-sm">{user.email}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600">
                <Phone size={18} className="text-slate-400" />
                <span className="text-sm">{user.mobile_number}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600">
                <Calendar size={18} className="text-slate-400" />
                <span className="text-sm">Joined {new Date(user.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600">
                <MapPin size={18} className="text-slate-400" />
                <span className="text-sm">{user.home_address || 'No address provided'}</span>
              </div>
            </div>
          </div>

          <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-lg shadow-indigo-100">
            <h4 className="text-indigo-100 text-xs font-bold uppercase tracking-widest mb-4">Wallet Balance</h4>
            <div className="flex items-end justify-between">
              <p className="text-3xl font-bold">₹{Number(user.wallet_balance || 0).toLocaleString()}</p>
              <CreditCard size={24} className="text-indigo-300" />
            </div>
          </div>
        </div>

        {/* Details Tabs/Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex border-b border-slate-50">
              <button 
                onClick={() => setActiveTab('firm')}
                className={`px-8 py-4 text-sm font-bold transition-colors ${activeTab === 'firm' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Firm Details
              </button>
              <button 
                onClick={() => setActiveTab('kyc')}
                className={`px-8 py-4 text-sm font-bold transition-colors ${activeTab === 'kyc' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                KYC Documents
              </button>
            </div>
            
            <div className="p-8">
              {activeTab === 'firm' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="md:col-span-2 p-6 rounded-2xl bg-slate-50/50 border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Firm Name</p>
                    <p className="text-lg font-bold text-slate-900">{user.firm_name || 'Not provided'}</p>
                  </div>
                  <div className="md:col-span-2 p-6 rounded-2xl bg-slate-50/50 border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Firm Address</p>
                    <p className="text-sm font-medium text-slate-600 leading-relaxed">{user.firm_address || 'Not provided'}</p>
                  </div>
                  <div className="p-6 rounded-2xl bg-slate-50/50 border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">QR Service Charge (%)</p>
                    <div className="flex items-center gap-2 text-indigo-600">
                      <Percent size={20} />
                      <p className="text-2xl font-bold">{user.charge_percentage}%</p>
                    </div>
                  </div>
                  <div className="p-6 rounded-2xl bg-slate-50/50 border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Service Charge On/Off</p>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${user.service_charge_enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        {user.service_charge_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      {user.service_charge_enabled && (
                        <p className="text-lg font-bold text-slate-900">₹{user.custom_service_charge}</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {loadingKyc ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <Loader2 size={32} className="animate-spin text-indigo-600" />
                      <p className="text-slate-500 text-sm font-medium">Loading KYC documents...</p>
                    </div>
                  ) : kycDocs ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                      {[
                        { label: 'Aadhaar Front', url: kycDocs.aadhaar_front_url },
                        { label: 'Aadhaar Back', url: kycDocs.aadhaar_back_url },
                        { label: 'PAN Card', url: kycDocs.pan_card_url },
                        { label: 'Blank Cheque', url: kycDocs.cheque_photo_url },
                        { label: 'User Selfie', url: kycDocs.selfie_url },
                        { label: 'Firm Photo', url: kycDocs.firm_photo_url }
                      ].filter(d => d.url).map((doc, i) => (
                        <div key={i} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{doc.label}</span>
                            <button 
                              onClick={() => setSelectedImage({url: doc.url, label: doc.label})}
                              className="text-indigo-600 hover:text-indigo-700 transition-colors"
                            >
                              <Download size={16} />
                            </button>
                          </div>
                          <div 
                            className="aspect-video rounded-2xl border border-slate-100 overflow-hidden bg-slate-50 relative group cursor-zoom-in"
                            onClick={() => setSelectedImage({url: doc.url, label: doc.label})}
                          >
                            <img src={doc.url} alt={doc.label} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                            <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/10 transition-colors pointer-events-none" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-4">
                        <FileText size={32} />
                      </div>
                      <p className="text-slate-500 font-medium">No approved KYC documents found.</p>
                      <p className="text-slate-400 text-xs mt-1">Wait for the user to complete verification.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-6">
            <button 
              onClick={() => onEdit(user)}
              className="flex-1 flex items-center justify-center gap-2 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
            >
              <Edit3 size={20} className="text-indigo-600" />
              Update Information
            </button>
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              className="flex-1 flex items-center justify-center gap-2 py-4 bg-rose-50 border border-rose-100 rounded-2xl font-bold text-rose-600 hover:bg-rose-100 transition-all shadow-sm active:scale-95"
            >
              <Trash2 size={20} />
              Delete User Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
