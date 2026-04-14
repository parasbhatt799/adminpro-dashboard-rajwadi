import React, { useState, useEffect } from 'react';
import { Megaphone } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../lib/supabase';

interface Headline {
  id: string;
  message: string;
}

export default function NewsTicker() {
  const [headlines, setHeadlines] = useState<Headline[]>([]);

  const fetchActiveHeadlines = async () => {
    try {
      const { data, error } = await supabase
        .from('headlines')
        .select('id, message')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setHeadlines(data || []);
    } catch (err) {
      console.error('Error fetching ticker headlines:', err);
    }
  };

  useEffect(() => {
    fetchActiveHeadlines();

    const channel = supabase
      .channel('headlines_realtime')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'headlines' 
      }, () => {
        fetchActiveHeadlines();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (headlines.length === 0) return null;

  // Use literal spaces for joining
  const separator = "         •         ";
  const combinedText = headlines.map(h => h.message).join(separator) + separator;

  return (
    <div className="bg-white border-b border-slate-200 h-10 flex items-center overflow-hidden shrink-0 relative">
      {/* Label */}
      <div className="bg-rose-600 h-full px-4 flex items-center gap-2 z-20 shadow-[4px_0_10px_rgba(0,0,0,0.1)] relative">
        <Megaphone size={14} className="text-white animate-pulse" />
        <span className="text-white text-[10px] font-black uppercase tracking-widest whitespace-nowrap">News Updates</span>
        <div className="absolute right-[-10px] top-0 bottom-0 w-[10px] bg-rose-600 [clip-path:polygon(0_0,0_100%,100%_50%)]"></div>
      </div>

      {/* Marquee Container */}
      <div className="flex-1 overflow-hidden h-full flex items-center">
        <motion.div
          animate={{ x: ["0%", "-50%"] }}
          transition={{ 
            duration: 35, 
            repeat: Infinity, 
            ease: "linear"
          }}
          className="whitespace-nowrap flex items-center"
        >
          <span className="text-sm font-bold text-slate-700 uppercase tracking-tight inline-block px-4">
            {combinedText}
          </span>
          <span className="text-sm font-bold text-slate-700 uppercase tracking-tight inline-block px-4">
            {combinedText}
          </span>
        </motion.div>
      </div>

      {/* Fade Effect at end */}
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white to-transparent pointer-events-none z-10"></div>
    </div>
  );
}
