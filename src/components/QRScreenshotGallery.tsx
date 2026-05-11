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

  useEffect(() => {
    fetchGalleryData();
  }, []);

  const fetchGalleryData = async () => {
    try {
      setLoading(true);
      let allSubmissions: any[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;

      while (hasMore) {
        setProgress({ current: allSubmissions.length, total: 0 }); // Use 0 to indicate unknown total
        const { data, error } = await supabase
          .from('payment_submissions')
          .select('*, qr_history!left(qr_name, whatsapp_number)')
          .order('created_at', { ascending: false })
          .range(from, from + step - 1);

        if (error) throw error;
        
        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allSubmissions = [...allSubmissions, ...data];
          if (data.length < step) {
            hasMore = false;
          } else {
            from += step;
          }
        }
      }

      console.log('Total Gallery Submissions Fetched:', allSubmissions.length);

      const grouped: { [date: string]: ScreenshotGroup } = {};
      
      allSubmissions.forEach(sub => {
        const date = sub.created_at.split('T')[0]; 
        const qrId = sub.qr_id || 'legacy';
        const qrName = (Array.isArray(sub.qr_history) ? sub.qr_history[0]?.qr_name : (sub.qr_history as any)?.qr_name) || 'Legacy QR';
        const whatsappNumber = (Array.isArray(sub.qr_history) ? sub.qr_history[0]?.whatsapp_number : (sub.qr_history as any)?.whatsapp_number);

        if (!grouped[date]) {
          grouped[date] = { date, qrs: {} };
        }

        if (!grouped[date].qrs[qrId]) {
          grouped[date].qrs[qrId] = { name: qrName, whatsappNumber, screenshots: [] };
        }

        grouped[date].qrs[qrId].screenshots.push({
          id: sub.id,
          url: sub.proof_url,
          amount: sub.amount,
          created_at: sub.created_at,
          is_shared: sub.is_shared
        });
      });

      const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
      setData(grouped);
      setDates(sortedDates);
      if (sortedDates.length > 0) setSelectedDate(sortedDates[0]);

    } catch (err) {
      console.error('Error fetching gallery data:', err);
    } finally {
      setLoading(false);
      setProgress(null);
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
        <Loader2 className="animate-spin text-indigo-600" size={48} />
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
      </div>

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
                  onClick={() => {
                    setSelectedDate(date);
                    setSelectedFolder(null);
                  }}
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
