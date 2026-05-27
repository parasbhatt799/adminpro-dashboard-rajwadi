import React from 'react';
import { motion } from 'motion/react';

interface LogoLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LogoLoader: React.FC<LogoLoaderProps> = ({ size = 'md', className = '' }) => {
  const containerSizes = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-20 h-20'
  };

  const imgSizes = {
    sm: 'w-6 h-6',
    md: 'w-9 h-9',
    lg: 'w-11 h-11'
  };

  const borderWidths = {
    sm: 'border-2',
    md: 'border-2',
    lg: 'border-2'
  };

  return (
    <div className={`relative ${containerSizes[size]} flex items-center justify-center ${className}`}>
      {/* Outer Rotating Loader Ring */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        className={`absolute inset-0 rounded-full ${borderWidths[size]} border-indigo-600 border-t-transparent`}
      />
      
      {/* Pulsing inner glow */}
      {size !== 'sm' && (
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="absolute inset-2 bg-indigo-500/5 rounded-full filter blur-xs"
        />
      )}

      {/* Branded Logo (fav.png) */}
      <motion.img
        src="/fav.png"
        alt="UsePay"
        animate={{ 
          scale: [0.9, 1.05, 0.9],
        }}
        transition={{ 
          repeat: Infinity, 
          duration: 2, 
          ease: "easeInOut" 
        }}
        className={`${imgSizes[size]} object-contain rounded-full relative z-10`}
      />
    </div>
  );
};

const LoadingSpinner = () => {
  return (
    <div className="fixed inset-0 z-[9999] bg-slate-50/80 backdrop-blur-sm flex items-center justify-center">
      <div className="relative">
        {/* Decorative background circle */}
        <div className="absolute inset-0 bg-indigo-500/10 blur-2xl rounded-full scale-150"></div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative bg-white p-8 rounded-[40px] shadow-2xl border border-slate-100 flex flex-col items-center gap-4 min-w-[240px]"
        >
          {/* Logo & Orbiting Ring Container */}
          <LogoLoader size="lg" />

          <div className="flex flex-col items-center">
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">UsePay</h3>
            <p className="text-xs text-slate-400 font-medium">Please wait a moment...</p>
          </div>

          {/* Staggered bouncing loading dots */}
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
