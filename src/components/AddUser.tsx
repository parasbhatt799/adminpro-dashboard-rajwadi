import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Building2, 
  Percent, 
  IndianRupee, 
  Camera,
  Save,
  Loader2
} from 'lucide-react';
import { motion } from 'motion/react';
import { useState, type FormEvent, type ChangeEvent } from 'react';
import { supabase } from '../lib/supabase';

interface AddUserProps {
  onBack: () => void;
  onSuccess: () => void;
  initialData?: any;
}

export default function AddUser({ onBack, onSuccess, initialData }: AddUserProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(initialData?.profile_photo_url || null);
  const splitName = (fullName: string) => {
    const parts = fullName ? fullName.trim().split(/\s+/) : [];
    if (parts.length === 0) return { firstName: '', middleName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], middleName: '', lastName: '' };
    if (parts.length === 2) return { firstName: parts[0], middleName: '', lastName: parts[1] };
    return {
      firstName: parts[0],
      middleName: parts.slice(1, -1).join(' '),
      lastName: parts[parts.length - 1]
    };
  };

  const initialNames = splitName(initialData?.name || '');

  const [formData, setFormData] = useState({
    firstName: initialNames.firstName,
    middleName: initialNames.middleName,
    lastName: initialNames.lastName,
    email: initialData?.email || '',
    mobile_number: initialData?.mobile_number || '',
    home_address: initialData?.home_address || '',
    firm_name: initialData?.firm_name || '',
    firm_address: initialData?.firm_address || '',
    charge_percentage: initialData?.charge_percentage?.toString() || '',
    service_charge_enabled: initialData?.service_charge_enabled ?? false,
    custom_service_charge: initialData?.custom_service_charge?.toString() || '',
  });

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfilePhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let profile_photo_url = initialData?.profile_photo_url || null;
      const generatedPassword = !initialData ? generatePassword() : null;

      // 1. Upload photo if selected
      if (profilePhoto) {
        const fileExt = profilePhoto.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('profiles')
          .upload(filePath, profilePhoto);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('profiles')
          .getPublicUrl(filePath);
        
        profile_photo_url = publicUrl;
      }

      // 2. Insert or Update user profile
      const fullName = [formData.firstName, formData.middleName, formData.lastName].filter(Boolean).join(' ');
      const userData: any = {
        name: fullName,
        email: formData.email,
        mobile_number: formData.mobile_number,
        home_address: formData.home_address,
        firm_name: formData.firm_name,
        firm_address: formData.firm_address,
        charge_percentage: parseFloat(formData.charge_percentage) || 0,
        service_charge_enabled: formData.service_charge_enabled,
        custom_service_charge: parseFloat(formData.custom_service_charge) || 0,
        profile_photo_url,
        status: initialData?.status || 'Active'
      };

      if (!initialData) {
        userData.password = generatedPassword;
        userData.must_change_password = true;
        userData.kyc_status = 'pending';
      }

      if (initialData) {
        const { error: updateError } = await supabase
          .from('users_profiles')
          .update(userData)
          .eq('id', initialData.id);
        
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('users_profiles')
          .insert([userData]);

        if (insertError) throw insertError;

        // Send actual email via backend
        try {
          const emailResponse = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: formData.email,
              subject: 'Welcome to Rajwadi - Your Account Details',
              html: `
                <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px;">
                  <h2 style="color: #4f46e5; margin-bottom: 24px;">Welcome to Rajwadi, ${fullName}!</h2>
                  <p style="font-size: 16px; line-height: 1.6;">Your account has been created by the administrator. You can now log in using the credentials below:</p>
                  
                  <div style="background: #f8fafc; padding: 24px; border-radius: 12px; margin: 24px 0; border: 1px solid #f1f5f9;">
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #64748b; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Login Credentials</p>
                    <p style="margin: 8px 0; font-size: 18px;"><strong>User ID (Mobile):</strong> <span style="color: #0f172a;">${formData.mobile_number}</span></p>
                    <p style="margin: 8px 0; font-size: 18px;"><strong>Password:</strong> <span style="color: #0f172a;">${generatedPassword}</span></p>
                  </div>
                  
                  <p style="font-size: 14px; color: #ef4444; font-weight: bold;">Important: You will be required to change your password upon your first login.</p>
                  
                  <p style="font-size: 16px; line-height: 1.6; margin-top: 24px;">After changing your password, you will need to complete your KYC verification to activate your dashboard.</p>
                  
                  <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
                  
                  <p style="font-size: 12px; color: #94a3b8; text-align: center;">This is an automated message from Rajwadi. Please do not reply to this email.</p>
                </div>
              `
            }),
          });

          const result = await emailResponse.json();
          
          if (!emailResponse.ok) {
            throw new Error(result.error || 'Unknown server error');
          }
          
          alert(`User created successfully!\n\nCredentials have been sent to ${formData.email}.\n\nID: ${formData.mobile_number}\nPassword: ${generatedPassword}`);
        } catch (emailErr) {
          console.error('Error calling email API:', emailErr);
          const errorMessage = emailErr instanceof Error ? emailErr.message : 'Unknown error';
          alert(`User created successfully, but email delivery failed.\n\nError: ${errorMessage}\n\nCredentials for manual sharing:\nID: ${formData.mobile_number}\nPassword: ${generatedPassword}`);
        }
      }

      onSuccess();
    } catch (err: any) {
      console.error('Error saving user:', err);
      setError(err.message || 'Failed to save user. Please check your Supabase table setup.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{initialData ? 'Update User' : 'Add New User'}</h2>
          <p className="text-slate-500 text-sm">
            {initialData ? `Updating information for ${initialData.name}` : 'Fill in the details below to register a new user in the system.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Basic Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 text-center">
            <div className="relative w-32 h-32 mx-auto mb-8 group">
              <label className="w-full h-full bg-slate-50 rounded-full border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 overflow-hidden cursor-pointer hover:border-indigo-400 hover:text-indigo-500 transition-all">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Camera size={32} />
                    <span className="text-[10px] font-bold uppercase mt-2">Upload Photo</span>
                  </>
                )}
                <input 
                  type="file" 
                  className="sr-only" 
                  accept="image/*"
                  onChange={handlePhotoChange}
                />
              </label>
              {photoPreview && (
                <button 
                  type="button"
                  onClick={() => { setProfilePhoto(null); setPhotoPreview(null); }}
                  className="absolute -top-2 -right-2 bg-rose-500 text-white p-1.5 rounded-full shadow-lg hover:bg-rose-600 transition-colors"
                >
                  <Loader2 size={12} className={loading ? "animate-spin" : ""} />
                </button>
              )}
            </div>
            
            <div className="space-y-4 text-left">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <label className="sm:w-24 text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">First Name</label>
                  <div className="relative flex-1">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      required
                      type="text" 
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      placeholder="Enter first name"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <label className="sm:w-24 text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Middle Name</label>
                  <div className="relative flex-1">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      placeholder="Enter middle name"
                      value={formData.middleName}
                      onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <label className="sm:w-24 text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Last Name</label>
                  <div className="relative flex-1">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      required
                      type="text" 
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      placeholder="Enter last name"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    required
                    type="email" 
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="user@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Mobile Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    required
                    type="tel" 
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="+1 234 567 890"
                    value={formData.mobile_number}
                    onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Address & Business Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
            <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
              <MapPin size={20} className="text-indigo-600" />
              Address & Business Details
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Home Address</label>
                <textarea 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[80px]"
                  placeholder="Enter complete home address"
                  value={formData.home_address}
                  onChange={(e) => setFormData({ ...formData, home_address: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Firm Name</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="Enter firm name"
                    value={formData.firm_name}
                    onChange={(e) => setFormData({ ...formData, firm_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Firm Address</label>
                <textarea 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[80px]"
                  placeholder="Enter firm address"
                  value={formData.firm_address}
                  onChange={(e) => setFormData({ ...formData, firm_address: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
            <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Percent size={20} className="text-indigo-600" />
              Service Charges
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">QR Service Charge (%)</label>
                <div className="relative">
                  <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="number" 
                    step="0.01"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="0.00"
                    value={formData.charge_percentage}
                    onChange={(e) => setFormData({ ...formData, charge_percentage: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col justify-center">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only"
                      checked={formData.service_charge_enabled}
                      onChange={(e) => setFormData({ ...formData, service_charge_enabled: e.target.checked })}
                    />
                    <div className={`w-12 h-6 rounded-full transition-colors ${formData.service_charge_enabled ? 'bg-indigo-600' : 'bg-slate-200'}`}></div>
                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.service_charge_enabled ? 'translate-x-6' : ''}`}></div>
                  </div>
                  <span className="text-sm font-bold text-slate-700">Service Charge On/Off</span>
                </label>
              </div>

              {formData.service_charge_enabled && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="md:col-span-2"
                >
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Custom Service Charge</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      placeholder="0.00"
                      value={formData.custom_service_charge}
                      onChange={(e) => setFormData({ ...formData, custom_service_charge: e.target.value })}
                    />
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm font-medium">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-4">
            <button 
              type="button"
              onClick={onBack}
              className="px-8 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="px-10 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              {initialData ? 'Update User' : 'Save User'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
