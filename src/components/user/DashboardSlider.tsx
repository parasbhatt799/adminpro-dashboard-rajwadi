import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function DashboardSlider() {
  const [sliders, setSliders] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const fetchSliders = async () => {
      try {
        const { data, error } = await supabase
          .from('dashboard_sliders')
          .select('*')
          .eq('is_active', true)
          .order('id', { ascending: true });
        
        if (error) throw error;
        setSliders(data || []);
      } catch (err) {
        console.error('Failed to fetch dashboard sliders:', err);
      }
    };
    fetchSliders();
  }, []);

  useEffect(() => {
    if (sliders.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % sliders.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [sliders.length]);

  if (sliders.length === 0) return null;

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? sliders.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % sliders.length);
  };

  return (
    <div className="relative w-full h-[120px] md:h-[180px] lg:h-[220px] rounded-3xl overflow-hidden shadow-sm border border-slate-200 bg-slate-100 group mb-6 z-20">
      <AnimatePresence mode="wait">
        <motion.img
          key={currentIndex}
          src={sliders[currentIndex].image_url}
          alt={`Slider ${currentIndex + 1}`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </AnimatePresence>

      {/* Navigation Controls */}
      {sliders.length > 1 && (
        <>
          <div className="absolute inset-0 flex items-center justify-between p-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={handlePrev}
              className="w-8 h-8 rounded-full bg-white/80 backdrop-blur shadow-sm flex items-center justify-center text-slate-800 hover:bg-white transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={handleNext}
              className="w-8 h-8 rounded-full bg-white/80 backdrop-blur shadow-sm flex items-center justify-center text-slate-800 hover:bg-white transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Dots */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {sliders.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  idx === currentIndex ? 'bg-white w-4' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
