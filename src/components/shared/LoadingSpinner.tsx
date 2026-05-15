import React from 'react';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = () => {
  return (
    <div className="fixed inset-0 z-[9999] bg-slate-50/80 backdrop-blur-sm flex items-center justify-center">
      <div className="relative">
        {/* Decorative background circle */}
        <div className="absolute inset-0 bg-indigo-500/10 blur-2xl rounded-full scale-150"></div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative bg-white p-8 rounded-[40px] shadow-2xl border border-slate-100 flex flex-col items-center gap-4"
        >
          <div className="relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="text-indigo-600"
            >
              <Loader2 size={48} strokeWidth={1.5} />
            </motion.div>
            
            {/* Pulsing inner dot */}
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
            </motion.div>
          </div>
          
          <div className="flex flex-col items-center">
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">Loading Experience</h3>
            <p className="text-xs text-slate-400 font-medium">Please wait a moment...</p>
          </div>

          <div className="flex gap-1 mt-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ 
                  scale: [1, 1.5, 1],
                  opacity: [0.3, 1, 0.3]
                }}
                transition={{ 
                  repeat: Infinity, 
                  duration: 1, 
                  delay: i * 0.2,
                  ease: "easeInOut" 
                }}
                className="w-1.5 h-1.5 bg-indigo-500/40 rounded-full"
              />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LoadingSpinner;
