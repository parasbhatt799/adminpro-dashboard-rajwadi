import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info' | 'confirm';
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel'
}: ModalProps) {
  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle className="text-emerald-500" size={32} />;
      case 'error': return <AlertCircle className="text-rose-500" size={32} />;
      case 'warning': return <AlertTriangle className="text-amber-500" size={32} />;
      case 'confirm': return <AlertTriangle className="text-indigo-500" size={32} />;
      default: return <Info className="text-blue-500" size={32} />;
    }
  };

  const getButtonClass = () => {
    switch (type) {
      case 'success': return 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100';
      case 'error': return 'bg-rose-600 hover:bg-rose-700 shadow-rose-100';
      case 'warning': return 'bg-amber-600 hover:bg-amber-700 shadow-amber-100';
      case 'confirm': return 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100';
      default: return 'bg-blue-600 hover:bg-blue-700 shadow-blue-100';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-sm relative z-[101] bg-white rounded-[2.5rem] shadow-2xl p-8 overflow-hidden text-center"
          >
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-2">
                {getIcon()}
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900">{title}</h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                  {message}
                </p>
              </div>

              <div className="w-full grid grid-cols-1 gap-3 pt-4">
                {type === 'confirm' ? (
                  <div className="flex gap-3">
                    <button
                      onClick={onClose}
                      className="flex-1 px-6 py-4 rounded-2xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all active:scale-95"
                    >
                      {cancelText}
                    </button>
                    <button
                      onClick={() => {
                        onConfirm?.();
                        onClose();
                      }}
                      className={`flex-1 px-6 py-4 rounded-2xl text-white font-bold transition-all shadow-lg active:scale-95 ${getButtonClass()}`}
                    >
                      {confirmText}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={onClose}
                    className={`w-full px-6 py-4 rounded-2xl text-white font-bold transition-all shadow-lg active:scale-95 ${getButtonClass()}`}
                  >
                    Got it
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
