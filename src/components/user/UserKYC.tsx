import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Upload,
  Camera,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Image as ImageIcon,
  User,
  Download,
  CreditCard,
  Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { sendAdminPushNotification } from '../../lib/notifications';
import { PDFDocument } from 'pdf-lib';
import SignatureCanvas from 'react-signature-canvas';
import { useRef } from 'react';

const AgreementSection = ({ template, sigCanvas, setHasSigned }: any) => (
  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-12">
    <div className="p-6 border-b border-slate-100 flex items-center gap-3">
      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
        <FileText size={20} />
      </div>
      <div>
        <h3 className="font-bold text-slate-900 leading-none">Step 1: User Agreement</h3>
        <p className="text-xs text-slate-500 mt-1">Please read and sign the agreement below</p>
      </div>
    </div>
    
    <div className="p-8 space-y-4">
      {/* Integrated Agreement Container */}
      <div className="border border-slate-200 rounded-3xl overflow-hidden bg-white shadow-inner">
        {/* PDF View - Reduced Height */}
        <div className="h-[350px] border-b border-slate-100 relative group">
          <iframe 
            src={`${template}#toolbar=0`} 
            className="w-full h-full border-none bg-white font-bold" 
            title="Agreement Template"
          />
          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <a 
              href={template} 
              target="_blank" 
              rel="noreferrer"
              className="bg-white/90 backdrop-blur-sm p-2 rounded-lg text-slate-600 hover:text-indigo-600 shadow-sm border border-slate-200"
            >
              <Download size={18} />
            </a>
          </div>
        </div>

        {/* Signature Area Directly Below */}
        <div className="p-6 bg-white space-y-4">
          <div className="flex items-center justify-between px-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Draw your signature below</label>
            <button 
              type="button"
              onClick={() => {
                sigCanvas.current.clear();
                setHasSigned(false);
              }}
              className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:text-rose-600 transition-colors"
            >
              Clear Canvas
            </button>
          </div>
          <div className="bg-white rounded-2xl overflow-hidden border-2 border-dashed border-slate-100 flex items-center justify-center min-h-[160px]">
            <SignatureCanvas 
              ref={sigCanvas}
              penColor="black"
              canvasProps={{
                className: "w-full cursor-crosshair h-40",
              }}
              onEnd={() => setHasSigned(true)}
            />
          </div>
        </div>
      </div>
      <p className="text-[10px] text-slate-400 text-center font-medium italic px-4">
        By signing above, you agree to the terms and conditions outlined in the agreement.
      </p>
    </div>
  </div>
);

interface UserKYCProps {
  userId: string;
  onStatusChange: () => void;
}

export default function UserKYC({ userId, onStatusChange }: UserKYCProps) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [kycData, setKycData] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [agreementTemplate, setAgreementTemplate] = useState<string | null>(null);
  const sigCanvas = useRef<any>(null);
  const [hasSigned, setHasSigned] = useState(false);

  const [files, setFiles] = useState<{ [key: string]: File | null }>({
    aadhaar_front: null,
    aadhaar_back: null,
    pan_card: null,
    cheque_photo: null,
    selfie: null,
    firm_photo: null
  });

  const [previews, setPreviews] = useState<{ [key: string]: string | null }>({
    aadhaar_front: null,
    aadhaar_back: null,
    pan_card: null,
    cheque_photo: null,
    selfie: null,
    firm_photo: null
  });

  const fetchKYCStatus = async () => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('users_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      setUserProfile(profile);

      const { data: kyc, error: kycError } = await supabase
        .from('kyc_submissions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (kycError) throw kycError;
      setKycData(kyc);

      // Fetch agreement template
      const { data: qrSettings } = await supabase
        .from('qr_settings')
        .select('agreement_pdf_url')
        .eq('id', 1)
        .single();
      
      if (qrSettings?.agreement_pdf_url) {
        setAgreementTemplate(qrSettings.agreement_pdf_url);
      }
    } catch (err) {
      console.error('Error fetching KYC:', err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchKYCStatus();
  }, [userId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    if (file) {
      setFiles(prev => ({ ...prev, [key]: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews(prev => ({ ...prev, [key]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all files are present
    const missingFiles = Object.keys(files).filter(key => !files[key]);
    if (missingFiles.length > 0) {
      setError('Please upload all required documents.');
      return;
    }

    if (agreementTemplate && !hasSigned) {
      setError('Please sign the User Agreement before submitting.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const urls: { [key: string]: string } = {};

      // 0. Process & Merge Agreement if exists
      if (agreementTemplate && sigCanvas.current) {
        const signatureDataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
        // Merge signature into PDF
        let existingPdfBytes: ArrayBuffer;
        
        try {
          // Extract path from public URL
          const pathParts = agreementTemplate.split('profiles/')[1];
          if (!pathParts) throw new Error('Invalid agreement template URL');
          
          const { data, error: downloadError } = await supabase.storage
            .from('profiles')
            .download(pathParts);
          
          if (downloadError) throw downloadError;
          existingPdfBytes = await data.arrayBuffer();
        } catch (fetchErr) {
          console.error('Fetch Template Error:', fetchErr);
          // Fallback to fetch if path extraction fails
          existingPdfBytes = await fetch(agreementTemplate).then(res => res.arrayBuffer());
        }

        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const signatureImage = await pdfDoc.embedPng(signatureDataUrl);
        
        const pages = pdfDoc.getPages();
        const lastPage = pages[pages.length - 1];
        const { width, height } = lastPage.getSize();
        
        // Draw signature at the bottom center
        const sigWidth = 150;
        const sigHeight = 75;
        
        lastPage.drawImage(signatureImage, {
          x: (width / 2) - (sigWidth / 2),
          y: 70, // Slightly higher from the bottom edge
          width: sigWidth,
          height: sigHeight,
        });

        const mergedPdfBytes = await pdfDoc.save();
        const mergedPdfBlob = new Blob([mergedPdfBytes as any], { type: 'application/pdf' });
        const mergedPdfFile = new File([mergedPdfBlob], 'signed_agreement.pdf', { type: 'application/pdf' });

        const agreementPath = `kyc/${userId}_signed_agreement_${Math.random().toString(36).substring(7)}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from('profiles')
          .upload(agreementPath, mergedPdfFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('profiles')
          .getPublicUrl(agreementPath);

        urls['signed_agreement_url'] = publicUrl;
      }

      // 1. Upload all files
      for (const key of Object.keys(files)) {
        const file = files[key]!;
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}_${key}_${Math.random()}.${fileExt}`;
        const filePath = `kyc/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('profiles')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('profiles')
          .getPublicUrl(filePath);

        urls[`${key}_url`] = publicUrl;
      }

      // 2. Create KYC submission
      const { error: kycError } = await supabase
        .from('kyc_submissions')
        .insert([{
          user_id: userId,
          ...urls,
          status: 'pending'
        }]);

      if (kycError) throw kycError;

      // 3. Update user profile status
      const { error: profileError } = await supabase
        .from('users_profiles')
        .update({ kyc_status: 'submitted' })
        .eq('id', userId);

      if (profileError) throw profileError;

      // 4. Create Notification for the admin
      const { error: nError } = await supabase
        .from('notifications')
        .insert([{
          target_role: 'admin',
          title: 'New KYC Request',
          message: `User ${userProfile?.name || userId} has submitted documents for verification.`,
          link: '/kyc-verification-requests'
        }]);

      if (nError) {
        console.error('KYC Notification Error (Admin):', nError);
      } else {
        console.log('KYC Notification sent to admin!');
        // 5. Send Push Notification to Admin (Mobile)
        sendAdminPushNotification(
          'New KYC Request',
          `User ${userProfile?.name || userId} has submitted documents for verification.`
        );
      }

      await fetchKYCStatus();
      onStatusChange();
    } catch (err: any) {
      console.error('Error submitting KYC:', err);
      setError(err.message || 'Failed to submit KYC documents.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="animate-spin text-emerald-600 mb-4" size={40} />
        <p className="text-slate-500 font-medium">Checking verification status...</p>
      </div>
    );
  }

  // If verified, show welcome
  if (userProfile?.kyc_status === 'verified') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl p-12 text-center border border-emerald-100 shadow-xl shadow-emerald-500/5"
      >
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mx-auto mb-6">
          <CheckCircle2 size={40} />
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Your Dashboard is active.</h2>
        <p className="text-xl text-emerald-600 font-bold mb-6">Welcome to UsePay</p>
        <p className="text-slate-500 max-w-md mx-auto">
          Your identity has been verified. You can now access all features of the portal.
        </p>
      </motion.div>
    );
  }

  // If submitted and pending
  if (userProfile?.kyc_status === 'submitted') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl p-12 text-center border border-amber-100 shadow-xl shadow-amber-500/5"
      >
        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 mx-auto mb-6">
          <ShieldCheck size={40} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Your Documents are currently Under verification</h2>
        <p className="text-lg text-amber-600 font-bold mb-6">Your dashboard will active within 24 hours.</p>
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 inline-block">
          <p className="text-sm text-slate-500">
            We are reviewing your Aadhaar, PAN, and Firm details.
          </p>
        </div>
      </motion.div>
    );
  }

  // If rejected or pending submission
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-900">KYC Verification</h2>
        <p className="text-slate-500 mt-2">Please upload the following documents to activate your account.</p>

        {userProfile?.kyc_status === 'rejected' && (
          <div className="mt-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-left">
            <AlertCircle size={24} className="shrink-0" />
            <div>
              <p className="font-bold">Verification Rejected</p>
              <p className="text-sm">{userProfile.kyc_rejection_reason || 'Please re-upload clear documents.'}</p>
            </div>
          </div>
        )}
      </div>

      {agreementTemplate && (
        <AgreementSection 
          template={agreementTemplate} 
          sigCanvas={sigCanvas} 
          setHasSigned={setHasSigned} 
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="md:col-span-2 lg:col-span-3">
             <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-1 mb-4 flex items-center gap-2">
               <Upload size={14} /> Step 2: KYC Documents
             </h3>
          </div>
          {[
            { key: 'aadhaar_front', label: 'Aadhaar Card (Front)', icon: FileText },
            { key: 'aadhaar_back', label: 'Aadhaar Card (Back)', icon: FileText },
            { key: 'pan_card', label: 'PAN Card', icon: CreditCard },
            { key: 'cheque_photo', label: 'Blank Cheque', icon: ImageIcon },
            { key: 'selfie', label: 'Your Selfie', icon: User },
            { key: 'firm_photo', label: 'Firm Photo (with Board)', icon: Building2 }
          ].map((doc) => (
            <div key={doc.key} className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">{doc.label}</label>
              <label className={`relative flex flex-col items-center justify-center aspect-video rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden ${previews[doc.key] ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-200 bg-white hover:border-indigo-400 hover:bg-slate-50'
                }`}>
                {previews[doc.key] ? (
                  <img src={previews[doc.key]!} alt={doc.label} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center text-slate-400">
                    <Upload size={24} />
                    <span className="text-[10px] font-bold mt-2">Click to upload</span>
                  </div>
                )}
                <input
                  type="file"
                  className="sr-only"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, doc.key)}
                />
              </label>
            </div>
          ))}
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm font-bold text-center">
            {error}
          </div>
        )}

        <div className="flex justify-center">
          <button
            type="submit"
            disabled={loading}
            className="px-12 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold transition-all shadow-xl shadow-emerald-200 flex items-center gap-3 disabled:opacity-50 active:scale-95"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
            Submit for Verification
          </button>
        </div>
      </form>
    </div>
  );
}




