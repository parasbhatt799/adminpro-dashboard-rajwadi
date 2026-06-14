import React, { useState, useEffect, useRef } from 'react';
import { User, Mail, Phone, Calendar, Building2, MapPin, Camera, Loader2, Shield, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';

interface UserProfileProps {
  userId: string;
}

export default function UserProfile({ userId }: UserProfileProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error('Error fetching user profile:', err);
      toast.error('Failed to load profile details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate image file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file.');
      return;
    }

    setUploading(true);
    try {
      // 1. Upload new photo to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      // 3. Update Database profile_photo_url
      const { error: dbError } = await supabase
        .from('users_profiles')
        .update({ 
          profile_photo_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (dbError) throw dbError;

      // 4. Delete old profile photo from Storage if it exists and is custom
      if (profile?.profile_photo_url) {
        try {
          const oldPath = profile.profile_photo_url.split('profiles/')[1];
          if (oldPath && oldPath !== filePath) {
            await supabase.storage.from('profiles').remove([oldPath]);
          }
        } catch (delErr) {
          console.warn('Failed to delete old photo (non-blocking):', delErr);
        }
      }

      toast.success('Profile photo updated successfully!');
      
      // Refresh profile data
      await fetchProfile();

    } catch (err: any) {
      console.error('Error updating profile photo:', err);
      toast.error(err.message || 'Failed to upload photo.');
    } finally {
      setUploading(false);
    }
  };

  const triggerFileInput = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading profile details...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-10 text-center md:text-left">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">My Profile</h2>
        <p className="text-slate-500 mt-2 font-medium">View your verified account details and manage your profile picture.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Profile Card & Photo Upload */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:col-span-1 space-y-6"
        >
          <div className="bg-white rounded-[32px] p-8 shadow-2xl shadow-slate-200/50 border border-slate-100 text-center relative overflow-hidden">
            {/* Top decorative background */}
            <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-br from-emerald-500/10 to-indigo-500/10"></div>
            
            {/* Avatar Photo Wrapper */}
            <div className="relative w-28 h-28 mx-auto mb-6 mt-4 group">
              <button 
                type="button"
                onClick={triggerFileInput}
                disabled={uploading}
                className="w-full h-full bg-slate-50 rounded-full border-4 border-white shadow-xl flex flex-col items-center justify-center text-slate-400 overflow-hidden cursor-pointer hover:border-emerald-400 hover:text-emerald-500 transition-all focus:outline-none relative"
                title="Click to Change Photo"
              >
                {profile?.profile_photo_url ? (
                  <img src={profile.profile_photo_url} alt="Profile" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                ) : (
                  <span className="text-3xl font-black text-emerald-600">{profile?.name?.charAt(0) || 'U'}</span>
                )}
                
                {/* Upload Hover Overlay */}
                <div className="absolute inset-0 bg-slate-950/45 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploading ? (
                    <Loader2 className="animate-spin text-white" size={20} />
                  ) : (
                    <>
                      <Camera size={20} />
                      <span className="text-[8px] font-black uppercase mt-1 tracking-wider">Change</span>
                    </>
                  )}
                </div>
              </button>
              
              {/* Hidden file input */}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handlePhotoUpload} 
                accept="image/*" 
                className="hidden" 
              />
            </div>

            <h3 className="text-xl font-black text-slate-900 leading-tight">{profile?.name}</h3>
            <p className="text-xs font-black text-slate-400 mt-2.5 flex items-center justify-center gap-1.5 bg-slate-50 py-1.5 px-3 rounded-xl border border-slate-100 w-fit mx-auto select-all">
              <Shield size={14} className="text-emerald-500" />
              <span>ID: {profile?.id}</span>
            </p>

            <div className="mt-5 flex justify-center gap-2">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                profile?.status === 'Active' ? 'text-emerald-600 bg-emerald-50' : 
                profile?.status === 'Suspended' ? 'text-rose-600 bg-rose-50' : 
                'text-amber-600 bg-amber-50'
              }`}>
                {profile?.status || 'Active'}
              </span>
              
              <span className="inline-flex items-center px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black uppercase tracking-wider text-slate-600">
                {profile?.role === 'super_distributor' ? 'Super Dist.' : profile?.role === 'distributor' ? 'Distributor' : 'Retailer'}
              </span>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-100 space-y-4 text-left">
              <div className="flex items-center gap-3 text-slate-600">
                <Mail size={18} className="text-slate-400 shrink-0" />
                <span className="text-sm font-semibold truncate" title={profile?.email}>{profile?.email}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600">
                <Phone size={18} className="text-slate-400 shrink-0" />
                <span className="text-sm font-semibold">{profile?.mobile_number}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600">
                <Calendar size={18} className="text-slate-400 shrink-0" />
                <span className="text-sm font-semibold">Joined {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Detailed Info Column */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="md:col-span-2 space-y-6"
        >
          <div className="bg-white rounded-[32px] p-8 shadow-2xl shadow-slate-200/50 border border-slate-100 space-y-8">
            <div>
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Building2 size={16} className="text-emerald-500" />
                Firm & Business Details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Firm Name</p>
                  <p className="text-base font-black text-slate-900">{profile?.firm_name || 'N/A'}</p>
                </div>
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 sm:col-span-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Firm Registered Address</p>
                  <p className="text-sm font-bold text-slate-700 leading-relaxed">{profile?.firm_address || 'N/A'}</p>
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-100 w-full"></div>

            <div>
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <MapPin size={16} className="text-indigo-500" />
                Personal Address Details
              </h4>
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Resident Address</p>
                <p className="text-sm font-bold text-slate-700 leading-relaxed">{profile?.home_address || 'N/A'}</p>
              </div>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-700">
              <ShieldCheck size={20} className="shrink-0" />
              <p className="text-[11px] font-bold leading-snug">
                Your profile information has been verified and locked by system administration. Please contact support if you need to update any business details.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
