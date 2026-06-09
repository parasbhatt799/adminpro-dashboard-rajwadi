import { LogoLoader } from './shared/LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { 
  LayoutGrid, 
  Folder, 
  Calendar, 
  ChevronRight, 
  Image as ImageIcon, 
  Loader2, 
  Search,
  X,
  ExternalLink,
  ChevronLeft,
  QrCode,
  MessageCircle,
  Download,
  Share2,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import JSZip from 'jszip';

interface ScreenshotGroup {
  date: string;
  qrs: {
    [qrId: string]: {
      name: string;
      whatsappNumber?: string;
      screenshots: {
        id: string;
        url: string;
        amount: number;
        created_at: string;
        is_shared?: boolean;
      }[];
    };
  };
}

export default function QRScreenshotGallery() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ [date: string]: ScreenshotGroup }>({});
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<{ qrId: string; folderIndex: number } | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null); // 'sharing' | 'downloading' | null
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [datePage, setDatePage] = useState(1);
  const DATES_PER_PAGE = 10;

  // Merchant Archive States
  const [galleryTab, setGalleryTab] = useState<'daily' | 'merchant'>('daily');
  const [merchantsLoading, setMerchantsLoading] = useState(false);
  const [merchantsSummary, setMerchantsSummary] = useState<{ [name: string]: { qrIds: string[]; count: number } }>({});
  const [merchantSearchQuery, setMerchantSearchQuery] = useState('');
  const [selectedMerchant, setSelectedMerchant] = useState<string | null>(null);
  const [merchantScreenshots, setMerchantScreenshots] = useState<any[]>([]);
  const [merchantDetailsLoading, setMerchantDetailsLoading] = useState(false);
  const [merchantPage, setMerchantPage] = useState(1);
  const [processingMerchant, setProcessingMerchant] = useState<string | null>(null);
  const IMAGES_PER_PAGE = 20;

  useEffect(() => {
    fetchDates();
  }, []);

  const fetchDates = async () => {
    try {
      setLoading(true);
      const { data: rpcDates, error } = await supabase.rpc('get_gallery_dates');
      if (error) throw error;
      
      const sortedDates = (rpcDates || []).map((d: any) => d.audit_date);
      setDates(sortedDates);
      if (sortedDates.length > 0) {
        setSelectedDate(sortedDates[0]);
        fetchDateScreenshots(sortedDates[0]);
      }
    } catch (err) {
      console.error('Error fetching gallery dates:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMerchantsSummary = async () => {
    try {
      setMerchantsLoading(true);
      
      let allSubmissions: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('payment_submissions')
          .select('qr_id, qr_history(qr_name)')
          .in('status', ['approved', 'T+1 Approved'])
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        
        if (data && data.length > 0) {
          allSubmissions = [...allSubmissions, ...data];
          page++;
          if (data.length < pageSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      const summary: { [name: string]: { qrIds: string[]; count: number } } = {};
      allSubmissions.forEach(sub => {
        const qrName = (Array.isArray(sub.qr_history) ? sub.qr_history[0]?.qr_name : (sub.qr_history as any)?.qr_name) || 'Legacy QR';
        const qrId = sub.qr_id || 'legacy';
        if (!summary[qrName]) {
          summary[qrName] = { qrIds: [], count: 0 };
        }
        if (qrId && !summary[qrName].qrIds.includes(qrId)) {
          summary[qrName].qrIds.push(qrId);
        }
        summary[qrName].count++;
      });
      setMerchantsSummary(summary);
    } catch (err) {
      console.error('Error fetching merchant summary:', err);
    } finally {
      setMerchantsLoading(false);
    }
  };

  const fetchAllMerchantSubmissions = async (merchantName: string) => {
    let allSubmissions: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('payment_submissions')
        .select('id, proof_url, amount, created_at')
        .in('status', ['approved', 'T+1 Approved'])
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (merchantName === 'Legacy QR') {
        query = query.is('qr_id', null);
      } else {
        const qrIds = merchantsSummary[merchantName]?.qrIds || [];
        if (qrIds.length === 0) break;
        query = query.in('qr_id', qrIds);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      if (data && data.length > 0) {
        allSubmissions = [...allSubmissions, ...data];
        page++;
        if (data.length < pageSize) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }
    return allSubmissions;
  };

  const fetchMerchantScreenshots = async (merchantName: string) => {
    try {
      setMerchantDetailsLoading(true);
      setSelectedMerchant(merchantName);
      setMerchantPage(1);
      
      const submissions = await fetchAllMerchantSubmissions(merchantName);
      setMerchantScreenshots(submissions);
    } catch (err) {
      console.error('Error fetching merchant screenshots:', err);
    } finally {
      setMerchantDetailsLoading(false);
    }
  };

  const handleDownloadMerchantAll = async (merchantName: string) => {
    try {
      setProcessingMerchant(merchantName);
      setIsProcessing('downloading');
      
      let screenshots = merchantScreenshots;
      if (selectedMerchant !== merchantName || screenshots.length === 0) {
        screenshots = await fetchAllMerchantSubmissions(merchantName);
      }

      if (screenshots.length === 0) {
        alert('No screenshots found to download.');
        setIsProcessing(null);
        setProcessingMerchant(null);
        return;
      }

      setProgress({ current: 0, total: screenshots.length });
      
      const zip = new JSZip();
      const folderName = `${merchantName.replace(/[^a-zA-Z0-9]/g, '_')}_Proofs`;
      const imgFolder = zip.folder(folderName);

      for (let i = 0; i < screenshots.length; i++) {
        setProgress({ current: i + 1, total: screenshots.length });
        const s = screenshots[i];
        
        try {
          const response = await fetch(s.proof_url);
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const blob = await response.blob();
          
          const dateStr = new Date(s.created_at).toLocaleDateString('en-GB').replace(/\//g, '-');
          const fileId = s.id.substring(0, 6);
          const fileName = `${merchantName.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}_₹${s.amount}_${fileId}.jpg`;
          
          imgFolder?.file(fileName, blob);
        } catch (fetchErr) {
          console.error(`Failed to fetch image ${s.proof_url}:`, fetchErr);
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${folderName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating zip:', err);
      alert('Failed to download zip package.');
    } finally {
      setIsProcessing(null);
      setProgress(null);
      setProcessingMerchant(null);
    }
  };

  const fetchDateScreenshots = async (date: string) => {
    try {
      setLoading(true);
      const { data: submissions, error } = await supabase
        .from('payment_submissions')
        .select('*, qr_history!left(qr_name, whatsapp_number)')
        .in('status', ['approved', 'T+1 Approved'])
        .gte('created_at', `${date}T00:00:00`)
        .lte('created_at', `${date}T23:59:59`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const grouped: ScreenshotGroup = { date, qrs: {} };
      
      (submissions || []).forEach(sub => {
        const qrId = sub.qr_id || 'legacy';
        const qrName = (Array.isArray(sub.qr_history) ? sub.qr_history[0]?.qr_name : (sub.qr_history as any)?.qr_name) || 'Legacy QR';
        const whatsappNumber = (Array.isArray(sub.qr_history) ? sub.qr_history[0]?.whatsapp_number : (sub.qr_history as any)?.whatsapp_number);

        if (!grouped.qrs[qrId]) {
          grouped.qrs[qrId] = { name: qrName, whatsappNumber, screenshots: [] };
        }

        grouped.qrs[qrId].screenshots.push({
          id: sub.id,
          url: sub.proof_url,
          amount: sub.amount,
          created_at: sub.created_at,
          is_shared: sub.is_shared
        });
      });

      setData(prev => ({ ...prev, [date]: grouped }));
    } catch (err) {
      console.error('Error fetching date screenshots:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSelectedFolder(null);
    if (!data[date]) {
      fetchDateScreenshots(date);
    }
  };

  const handleShareFolder = async (qrId: string, folderIndex: number) => {
    if (!selectedDate) return;
    const qrData = data[selectedDate].qrs[qrId];
    const screenshots = chunkArray(qrData.screenshots, 10)[folderIndex];

    try {
      setIsProcessing('sharing');
      setProgress({ current: 0, total: screenshots.length });
      
      const files: File[] = [];
      
      for (let i = 0; i < screenshots.length; i++) {
        setProgress({ current: i + 1, total: screenshots.length });
        const s = screenshots[i];
        
        const response = await fetch(s.url);
        const blob = await response.blob();
        const fileName = `${qrData.name}_${i + 1}.jpg`;
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        files.push(file);
      }

      if (navigator.canShare && navigator.canShare({ files })) {
        await navigator.share({
          files,
          title: `${qrData.name} Proofs`,
          text: `Audit Date: ${selectedDate} | Folder: ${folderIndex + 1}`
        });

        // Mark as shared in database
        const ids = screenshots.map(s => s.id);
        const { error: updateError } = await supabase
          .from('payment_submissions')
          .update({ is_shared: true })
          .in('id', ids);

        if (!updateError) {
          // Optimistic update
          setData(prev => {
            const newData = { ...prev };
            const qr = newData[selectedDate].qrs[qrId];
            const updatedScreenshots = [...qr.screenshots];
            ids.forEach(id => {
              const idx = updatedScreenshots.findIndex(s => s.id === id);
              if (idx !== -1) updatedScreenshots[idx].is_shared = true;
            });
            qr.screenshots = updatedScreenshots;
            return newData;
          });
        }
      } else {
        alert("Your browser doesn't support sharing multiple photos at once. Please try on a mobile phone or use the Download button instead.");
      }
      
    } catch (err: any) {
      console.error('Error sharing files:', err);
      if (err.name !== 'AbortError') {
        alert('Failed to share photos. Please try downloading them instead.');
      }
    } finally {
      setIsProcessing(null);
      setProgress(null);
    }
  };

  const handleDownloadFolder = async (qrId: string, folderIndex: number) => {
    if (!selectedDate) return;
    const qrData = data[selectedDate].qrs[qrId];
    const screenshots = chunkArray(qrData.screenshots, 10)[folderIndex];

    try {
      setIsProcessing('downloading');
      setProgress({ current: 0, total: screenshots.length });
      
      const zip = new JSZip();
      const folderName = `${qrData.name}_Audit_${selectedDate}_F${folderIndex + 1}`;
      const imgFolder = zip.folder(folderName);

      for (let i = 0; i < screenshots.length; i++) {
        setProgress({ current: i + 1, total: screenshots.length });
        const s = screenshots[i];
        
        const response = await fetch(s.url);
        const blob = await response.blob();
        imgFolder?.file(`${qrData.name}_${i + 1}.jpg`, blob);
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${folderName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Error downloading files:', err);
      alert('Failed to download the folder.');
    } finally {
      setIsProcessing(null);
      setProgress(null);
    }
  };

  const chunkArray = (arr: any[], size: number) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <LogoLoader size="md" className="mx-auto" />
        <div className="text-center">
          <p className="text-slate-500 font-bold animate-pulse">Scanning Historical Records...</p>
          {progress && (
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Found {progress.current.toLocaleString()} payments so far...
            </p>
          )}
        </div>
      </div>
    );
  }

  const currentDateData = selectedDate ? data[selectedDate] : null;
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <LayoutGrid className="text-indigo-600" />
            QR Gallery
          </h2>
          <p className="text-slate-500 mt-1">Organized auditing of all payment proofs from the system inception.</p>
        </div>

        {/* Tab Selector */}
        <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1 self-start md:self-auto shadow-inner">
          <button
            onClick={() => {
              setGalleryTab('daily');
              setSelectedFolder(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              galleryTab === 'daily'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Daily Audits
          </button>
          <button
            onClick={() => {
              setGalleryTab('merchant');
              setSelectedMerchant(null);
              if (Object.keys(merchantsSummary).length === 0) {
                fetchMerchantsSummary();
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              galleryTab === 'merchant'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Merchant Archive
          </button>
        </div>
      </div>

      {galleryTab === 'daily' ? (
        /* --- Daily Audits Layout --- */
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Date Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                <Calendar size={18} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Select Audit Date</span>
              </div>
              <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-50">
                {dates.slice((datePage - 1) * DATES_PER_PAGE, datePage * DATES_PER_PAGE).map(date => (
                  <button
                    key={date}
                    onClick={() => handleDateSelect(date)}
                    className={`w-full px-6 py-4 flex items-center justify-between transition-all group ${
                      selectedDate === date 
                        ? 'bg-indigo-50/50 text-indigo-600' 
                        : 'hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="text-sm font-bold">
                      {new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    <ChevronRight 
                      size={16} 
                      className={`transition-transform ${selectedDate === date ? 'translate-x-1' : 'opacity-0 group-hover:opacity-100'}`} 
                    />
                  </button>
                ))}
              </div>

              {dates.length > DATES_PER_PAGE && (
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setDatePage(prev => Math.max(1, prev - 1))}
                    disabled={datePage === 1}
                    className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center flex-1">
                    Page {datePage} of {Math.ceil(dates.length / DATES_PER_PAGE)}
                  </span>
                  <button
                    onClick={() => setDatePage(prev => Math.min(Math.ceil(dates.length / DATES_PER_PAGE), prev + 1))}
                    disabled={datePage === Math.ceil(dates.length / DATES_PER_PAGE)}
                    className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Gallery Content */}
          <div className="lg:col-span-3 space-y-8">
            <AnimatePresence mode="wait">
              {!selectedFolder ? (
                <motion.div
                  key="folders"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  {currentDateData && Object.entries(currentDateData.qrs).map(([qrId, qrData]) => (
                    <div key={qrId} className="space-y-4">
                      <div className="flex items-center gap-3 px-2">
                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                          <QrCode size={20} />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900">{qrData.name}</h3>
                          <p className="text-xs text-slate-400 font-medium">{qrData.screenshots.length} Approved Payments</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                        {chunkArray(qrData.screenshots, 10).map((chunk, index) => {
                          const isAnyShared = chunk.some(s => s.is_shared);
                          const isAllShared = chunk.every(s => s.is_shared);

                          return (
                            <button
                              key={index}
                              onClick={() => setSelectedFolder({ qrId, folderIndex: index })}
                              className={`relative p-6 rounded-3xl border transition-all flex flex-col items-center text-center group ${
                                isAllShared 
                                  ? 'bg-emerald-50 border-emerald-100 shadow-sm' 
                                  : 'bg-white border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100'
                              }`}
                            >
                              {isAnyShared && (
                                <div className="absolute top-3 right-3 flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500 text-white rounded-full shadow-lg">
                                  <CheckCircle2 size={10} />
                                  <span className="text-[8px] font-bold uppercase">Shared</span>
                                </div>
                              )}
                              <div className="relative mb-4">
                                <Folder 
                                  size={48} 
                                  className={`transition-colors ${isAllShared ? 'text-emerald-200' : 'text-indigo-100 group-hover:text-indigo-200'}`} 
                                  fill="currentColor" 
                                />
                                <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold pt-1 ${isAllShared ? 'text-emerald-600' : 'text-indigo-600'}`}>
                                  {chunk.length}
                                </span>
                              </div>
                              <span className={`text-xs font-bold ${isAllShared ? 'text-emerald-700' : 'text-slate-700'}`}>Folder {index + 1}</span>
                              <span className={`text-[10px] font-medium mt-1 ${isAllShared ? 'text-emerald-400' : 'text-slate-400'}`}>Items {index * 10 + 1}-{index * 10 + chunk.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="images"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setSelectedFolder(null)}
                        className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-all"
                      >
                        <ChevronLeft size={24} />
                      </button>
                      <div className="flex flex-wrap items-center gap-3">
                        <div>
                          <h3 className="font-bold text-slate-900">
                            {currentDateData?.qrs[selectedFolder.qrId].name} • Folder {selectedFolder.folderIndex + 1}
                          </h3>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            {new Date(selectedDate!).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            disabled={!!isProcessing}
                            onClick={() => handleShareFolder(selectedFolder.qrId, selectedFolder.folderIndex)}
                            className={`flex items-center gap-2 px-4 py-2 text-white rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95 ${
                              isProcessing === 'sharing' 
                                ? 'bg-slate-400' 
                                : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-100'
                            }`}
                          >
                            {isProcessing === 'sharing' ? (
                              <><Loader2 size={16} className="animate-spin" /> Preparing {progress?.current}/{progress?.total}...</>
                            ) : (
                              <><Share2 size={16} /> Share Proofs</>
                            )}
                          </button>

                          <button
                            disabled={!!isProcessing}
                            onClick={() => handleDownloadFolder(selectedFolder.qrId, selectedFolder.folderIndex)}
                            className={`flex items-center gap-2 px-4 py-2 text-white rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95 ${
                              isProcessing === 'downloading' 
                                ? 'bg-slate-400' 
                                : 'bg-indigo-500 hover:bg-indigo-600 shadow-indigo-100'
                            }`}
                          >
                            {isProcessing === 'downloading' ? (
                              <><Loader2 size={16} className="animate-spin" /> Saving {progress?.current}/{progress?.total}...</>
                            ) : (
                              <><Download size={16} /> Save to PC</>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                    {chunkArray(currentDateData!.qrs[selectedFolder.qrId].screenshots, 10)[selectedFolder.folderIndex].map((img, i) => (
                      <div 
                        key={img.id}
                        className={`group rounded-2xl border shadow-sm overflow-hidden transition-all ${
                          img.is_shared ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100 hover:border-indigo-200'
                        }`}
                      >
                        <div className="aspect-[3/4] relative overflow-hidden bg-slate-50">
                          <img 
                            src={img.url} 
                            alt="Payment Proof" 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          {img.is_shared && (
                            <div className="absolute top-2 right-2 bg-emerald-500 text-white p-1 rounded-full shadow-lg z-10">
                              <CheckCircle2 size={12} />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-indigo-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button 
                              onClick={() => setSelectedImage(img.url)}
                              className="p-2 bg-white text-indigo-600 rounded-lg shadow-xl active:scale-90 transition-all"
                            >
                              <ImageIcon size={18} />
                            </button>
                            <button 
                              onClick={() => window.open(img.url, '_blank')}
                              className="p-2 bg-white text-indigo-600 rounded-lg shadow-xl active:scale-90 transition-all"
                            >
                              <ExternalLink size={18} />
                            </button>
                          </div>
                        </div>
                        <div className={`p-3 ${img.is_shared ? 'bg-emerald-50' : 'bg-white'}`}>
                          <p className={`text-xs font-bold text-center ${img.is_shared ? 'text-emerald-700' : 'text-slate-900'}`}>₹{img.amount.toLocaleString()}</p>
                          <p className={`text-[9px] font-bold text-center mt-0.5 uppercase ${img.is_shared ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {new Date(img.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        /* --- Merchant Archive Layout --- */
        <div className="space-y-6">
          {!selectedMerchant ? (
            /* --- Merchant List View --- */
            <div className="space-y-6">
              {/* Search and Summary Bar */}
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search merchant..."
                    value={merchantSearchQuery}
                    onChange={(e) => setMerchantSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all font-medium text-slate-700"
                  />
                  {merchantSearchQuery && (
                    <button
                      onClick={() => setMerchantSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Total {Object.keys(merchantsSummary).length} Merchants
                </div>
              </div>

              {/* Loader */}
              {merchantsLoading ? (
                <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
                  <Loader2 className="animate-spin text-indigo-600" size={32} />
                  <p className="text-slate-500 font-bold">Scanning merchant records...</p>
                </div>
              ) : (
                /* Grid of Merchant Folders */
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                  {Object.entries(merchantsSummary)
                    .filter(([name]) => name.toLowerCase().includes(merchantSearchQuery.toLowerCase()))
                    .map(([name, detail]) => (
                      <div
                        key={name}
                        className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all flex flex-col justify-between group relative"
                      >
                        <div className="flex flex-col items-center text-center">
                          <div className="relative mb-4">
                            <Folder
                              size={56}
                              className="text-indigo-100 group-hover:text-indigo-200 transition-colors"
                              fill="currentColor"
                            />
                            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold pt-1.5 text-indigo-600">
                              {detail.count}
                            </span>
                          </div>
                          <h3 className="font-bold text-slate-800 text-sm line-clamp-1 group-hover:text-indigo-600 transition-colors">
                            {name}
                          </h3>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            Proofs Available
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-6">
                          <button
                            onClick={() => fetchMerchantScreenshots(name)}
                            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-xl text-xs font-bold transition-all"
                          >
                            View
                          </button>
                          <button
                            disabled={!!isProcessing}
                            onClick={() => handleDownloadMerchantAll(name)}
                            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                          >
                            {isProcessing === 'downloading' && processingMerchant === name ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <>
                                <Download size={14} />
                                ZIP
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : (
            /* --- Merchant Details View --- */
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setSelectedMerchant(null)}
                    className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-all"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <div>
                    <h3 className="font-bold text-slate-900">{selectedMerchant}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                      Merchant Archive • {merchantScreenshots.length} Proofs
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={!!isProcessing}
                    onClick={() => handleDownloadMerchantAll(selectedMerchant)}
                    className={`flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95 ${
                      isProcessing === 'downloading'
                        ? 'bg-slate-400'
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'
                    }`}
                  >
                    {isProcessing === 'downloading' && processingMerchant === selectedMerchant ? (
                      <><Loader2 size={16} className="animate-spin" /> Fetching {progress?.current}/{progress?.total}...</>
                    ) : (
                      <><Download size={16} /> Download All as ZIP</>
                    )}
                  </button>
                </div>
              </div>

              {/* Screenshots Grid */}
              {merchantDetailsLoading ? (
                <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
                  <Loader2 className="animate-spin text-indigo-600" size={32} />
                  <p className="text-slate-500 font-bold">Loading proof images...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {merchantScreenshots.length === 0 ? (
                    <div className="p-12 bg-white rounded-3xl border border-slate-100 text-center text-slate-400">
                      No approved payment proofs found for this merchant.
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                        {merchantScreenshots
                          .slice((merchantPage - 1) * IMAGES_PER_PAGE, merchantPage * IMAGES_PER_PAGE)
                          .map((img) => (
                            <div
                              key={img.id}
                              className="group bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:border-indigo-200 transition-all"
                            >
                              <div className="aspect-[3/4] relative overflow-hidden bg-slate-50">
                                <img
                                  src={img.proof_url}
                                  alt="Payment Proof"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                                <div className="absolute inset-0 bg-indigo-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => setSelectedImage(img.proof_url)}
                                    className="p-2 bg-white text-indigo-600 rounded-lg shadow-xl active:scale-90 transition-all"
                                  >
                                    <ImageIcon size={18} />
                                  </button>
                                  <button
                                    onClick={() => window.open(img.proof_url, '_blank')}
                                    className="p-2 bg-white text-indigo-600 rounded-lg shadow-xl active:scale-90 transition-all"
                                  >
                                    <ExternalLink size={18} />
                                  </button>
                                </div>
                              </div>
                              <div className="p-3">
                                <p className="text-xs font-bold text-center text-slate-900">
                                  ₹{img.amount.toLocaleString()}
                                </p>
                                <p className="text-[9px] font-bold text-center mt-0.5 text-slate-400 uppercase">
                                  {new Date(img.created_at).toLocaleDateString('en-GB')} {new Date(img.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          ))}
                      </div>

                      {/* Pagination for Merchant Screenshots */}
                      {merchantScreenshots.length > IMAGES_PER_PAGE && (
                        <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-slate-100 shadow-sm max-w-md mx-auto">
                          <button
                            onClick={() => setMerchantPage(prev => Math.max(1, prev - 1))}
                            disabled={merchantPage === 1}
                            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center flex-1">
                            Page {merchantPage} of {Math.ceil(merchantScreenshots.length / IMAGES_PER_PAGE)}
                          </span>
                          <button
                            onClick={() => setMerchantPage(prev => Math.min(Math.ceil(merchantScreenshots.length / IMAGES_PER_PAGE), prev + 1))}
                            disabled={merchantPage === Math.ceil(merchantScreenshots.length / IMAGES_PER_PAGE)}
                            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Global Processing Progress Overlay */}
      <AnimatePresence>
        {isProcessing && progress && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] p-8 max-w-sm w-full text-center shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200"
            >
              <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-600">
                <Loader2 size={32} className="animate-spin" />
              </div>
              
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {isProcessing === 'downloading' ? 'Saving Proofs to ZIP...' : 'Preparing Proofs to Share...'}
              </h3>
              
              <p className="text-slate-500 text-sm font-medium mb-6">
                Downloading image {progress.current} of {progress.total}
              </p>

              {/* Progress Bar */}
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-2 relative">
                <div 
                  className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                ></div>
              </div>
              
              <span className="text-xs font-black text-indigo-600">
                {Math.round((progress.current / progress.total) * 100)}% Complete
              </span>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full Preview Modal */}
      <AnimatePresence>
        {selectedImage && (
          <div 
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-full max-h-full"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setSelectedImage(null)}
                className="absolute -top-12 right-0 p-2 text-white hover:text-indigo-400 transition-colors"
              >
                <X size={32} />
              </button>
              <img 
                src={selectedImage} 
                alt="Full Preview" 
                className="max-w-[90vw] max-h-[85vh] rounded-2xl shadow-2xl border-4 border-white/10"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
