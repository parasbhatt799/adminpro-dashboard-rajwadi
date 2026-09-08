import React from 'react';
import { motion } from 'motion/react';

interface LogoLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  theme?: 'dark' | 'light' | 'auto';
}

export const LogoLoader: React.FC<LogoLoaderProps> = ({ size = 'md', className = '', theme = 'auto' }) => {
  const isDark = theme === 'dark' || (theme === 'auto' && (typeof window !== 'undefined' && (window.location.pathname.toLowerCase().includes('/b2b') || document.documentElement.classList.contains('dark'))));

  const containerSizes = {
    sm: 'w-6 h-6',
    md: 'w-16 h-16',
    lg: 'w-20 h-20'
  };

  const imgSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-9 h-9',
    lg: 'w-11 h-11'
  };

  const borderWidths = {
    sm: 'border-2',
    md: 'border-2',
    lg: 'border-2'
  };

  const ringColor = isDark
    ? 'border-indigo-400 border-t-transparent drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]'
    : 'border-indigo-600 border-t-transparent';

  const glowColor = isDark ? 'bg-indigo-500/20' : 'bg-indigo-500/5';

  return (
    <div className={`relative ${containerSizes[size]} flex items-center justify-center ${className}`}>
      {/* Outer Rotating Loader Ring */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1.8, ease: "linear" }}
        className={`absolute inset-0 rounded-full ${borderWidths[size]} ${ringColor}`}
      />
      
      {/* Pulsing inner glow */}
      {size !== 'sm' && (
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className={`absolute inset-2 ${glowColor} rounded-full filter blur-xs`}
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

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  theme?: 'dark' | 'light' | 'auto';
  fullScreen?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'lg', 
  className = '', 
  theme = 'auto',
  fullScreen = true
}) => {
  if (size === 'sm') {
    return <LogoLoader size="sm" theme={theme} className={className} />;
  }

  const isDark = theme === 'dark' || (theme === 'auto' && (typeof window !== 'undefined' && (window.location.pathname.toLowerCase().includes('/b2b') || document.documentElement.classList.contains('dark'))));

  const containerClasses = fullScreen 
    ? `fixed inset-0 z-[9999] ${isDark ? 'bg-slate-950/85' : 'bg-slate-50/80'} backdrop-blur-md flex items-center justify-center ${className}`
    : `relative flex items-center justify-center p-6 w-full ${className}`;

  const cardClasses = isDark
    ? "relative bg-slate-900/90 border border-slate-700/80 p-8 rounded-[40px] shadow-2xl shadow-indigo-950/60 flex flex-col items-center gap-4 min-w-[250px] backdrop-blur-xl ring-1 ring-white/10"
    : "relative bg-white/95 p-8 rounded-[40px] shadow-2xl border border-slate-100 flex flex-col items-center gap-4 min-w-[240px]";

  const textTitleClasses = isDark
    ? "text-lg font-extrabold text-white tracking-tight drop-shadow-sm"
    : "text-lg font-bold text-slate-900 tracking-tight";

  const textSubClasses = isDark
    ? "text-xs text-slate-400 font-medium tracking-wide"
    : "text-xs text-slate-400 font-medium";

  const dotClasses = isDark
    ? "w-1.5 h-1.5 bg-indigo-400 rounded-full shadow-[0_0_6px_rgba(129,140,248,0.8)]"
    : "w-1.5 h-1.5 bg-indigo-500/40 rounded-full";

  const glowBg = isDark
    ? "absolute inset-0 bg-indigo-500/25 blur-3xl rounded-full scale-150"
    : "absolute inset-0 bg-indigo-500/10 blur-2xl rounded-full scale-150";

  return (
    <div className={containerClasses}>
      <div className="relative">
        {/* Decorative background circle */}
        <div className={glowBg}></div>

        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cardClasses}
        >
          {/* Logo & Orbiting Ring Container */}
          <LogoLoader size={size} theme={theme} />

          <div className="flex flex-col items-center">
            <h3 className={textTitleClasses}>UsePay</h3>
            <p className={textSubClasses}>Please wait a moment...</p>
          </div>

          {/* Staggered bouncing loading dots */}
          <div className="flex gap-1.5 mt-2">
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
                className={dotClasses}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LoadingSpinner;
