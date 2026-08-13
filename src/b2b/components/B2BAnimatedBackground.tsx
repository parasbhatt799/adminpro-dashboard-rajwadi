import React from 'react';
import { motion } from 'motion/react';

export default function B2BAnimatedBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none">
      {/* Dark Slate Base Background */}
      <div className="absolute inset-0 bg-slate-900" />

      {/* Cyber Grid Pattern Overlay */}
      <div 
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage: `radial-gradient(#6366f1 1px, transparent 1px)`,
          backgroundSize: '32px 32px'
        }}
      />

      {/* Floating Animated Ambient Glow Blobs */}
      {/* Blob 1: Top-Left Indigo Glow */}
      <motion.div
        className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px]"
        animate={{
          x: [0, 80, 0],
          y: [0, 50, 0],
          scale: [1, 1.25, 1],
          opacity: [0.15, 0.3, 0.15],
        }}
        transition={{
          duration: 14,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Blob 2: Bottom-Right Purple Glow */}
      <motion.div
        className="absolute -bottom-32 -right-32 w-[30rem] h-[30rem] bg-purple-600/20 rounded-full blur-[140px]"
        animate={{
          x: [0, -90, 0],
          y: [0, -60, 0],
          scale: [1.2, 1, 1.2],
          opacity: [0.2, 0.35, 0.2],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Blob 3: Center-Right Cyan Accent Glow */}
      <motion.div
        className="absolute top-1/3 -right-20 w-80 h-80 bg-cyan-500/15 rounded-full blur-[100px]"
        animate={{
          x: [0, -50, 0],
          y: [0, 70, 0],
          scale: [1, 1.15, 1],
          opacity: [0.1, 0.25, 0.1],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Blob 4: Bottom-Left Blue Glow */}
      <motion.div
        className="absolute top-2/3 -left-20 w-84 h-84 bg-blue-600/15 rounded-full blur-[110px]"
        animate={{
          x: [0, 60, 0],
          y: [0, -40, 0],
          scale: [1.1, 1, 1.1],
          opacity: [0.15, 0.3, 0.15],
        }}
        transition={{
          duration: 16,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
}
