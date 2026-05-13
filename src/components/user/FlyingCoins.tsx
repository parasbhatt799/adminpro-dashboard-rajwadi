import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface FlyingCoinsProps {
  show: boolean;
  onComplete: () => void;
  targetRef: React.RefObject<HTMLDivElement>;
  direction?: 'add' | 'deduct';
  entryId?: string | null;
}

export default function FlyingCoins({ show, onComplete, targetRef, direction = 'add', entryId }: FlyingCoinsProps) {
  const coinsCount = 45; // More coins for the effect
  const coins = Array.from({ length: coinsCount });

  // Play sound effect when animation starts
  React.useEffect(() => {
    if (show) {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3');
      audio.volume = 0.4;
      audio.play().catch(err => console.log('Audio play blocked:', err));
    }
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[999] pointer-events-none">
          {coins.map((_, i) => {
            // Target position (Wallet icon)
            const rect = targetRef.current?.getBoundingClientRect();
            const walletX = rect ? rect.left + rect.width / 2 : window.innerWidth - 100;
            const walletY = rect ? rect.top + rect.height / 2 : 50;

            // Entry position (Source/Dest)
            let entryX = window.innerWidth / 2;
            let entryY = window.innerHeight * 0.8;

            if (entryId) {
              const el = document.getElementById(entryId);
              if (el) {
                const r = el.getBoundingClientRect();
                entryX = r.left + r.width / 2;
                entryY = r.top + r.height / 2;
              }
            }
            
            // Define 3 lanes
            const laneOffset = (i % 3 - 1) * 60; // -60, 0, 60
            
            const startX = direction === 'add' ? entryX : walletX;
            const startY = direction === 'add' ? entryY : walletY;
            const endX = direction === 'add' ? walletX : entryX;
            const endY = direction === 'add' ? walletY : entryY;

            // Subway surfers "magnet" effect: start in lane, then converge
            const midX = direction === 'add' 
              ? (startX + endX) / 2 + laneOffset 
              : (startX + endX) / 2 + laneOffset;
            const midY = (startY + endY) / 2;

            return (
              <motion.div
                key={i}
                initial={{ 
                  x: startX, 
                  y: startY, 
                  scale: 0,
                  opacity: 0,
                  rotate: 0
                }}
                animate={{ 
                  x: [startX, midX, endX],
                  y: [startY, midY, endY],
                  scale: [0, 1, 1.2, 0.5],
                  opacity: [0, 1, 1, 1, 0],
                  rotate: 720
                }}
                transition={{ 
                  duration: 0.8,
                  delay: (i / 3) * 0.04, // Stagger by lane groups
                  ease: "circOut"
                }}
                onAnimationComplete={() => {
                  if (i === coinsCount - 1) onComplete();
                }}
                className={`absolute w-5 h-5 rounded-full border-2 shadow-2xl flex items-center justify-center overflow-hidden ${
                  direction === 'add' ? 'bg-yellow-400 border-yellow-500' : 'bg-rose-400 border-rose-500'
                }`}
                style={{
                  zIndex: coinsCount - i
                }}
              >
                <div className={`text-[9px] font-black ${direction === 'add' ? 'text-yellow-700' : 'text-rose-700'}`}>₹</div>
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent"></div>
              </motion.div>
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
}
