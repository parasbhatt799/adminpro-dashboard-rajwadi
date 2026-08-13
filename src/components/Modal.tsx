import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  type?: 'success' | 'error' | 'warning' | 'info' | 'confirm';
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  children?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
  isDark?: boolean;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  children,
  size = 'sm',
  isDark = false
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

  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'max-w-sm';
      case 'md': return 'max-w-md';
      case 'lg': return 'max-w-lg';
      case 'xl': return 'max-w-xl';
      case '2xl': return 'max-w-2xl';
      case '3xl': return 'max-w-3xl';
      case '4xl': return 'max-w-4xl';
      case '5xl': return 'max-w-5xl';
      case 'full': return 'max-w-full mx-4';
      default: return 'max-w-sm';
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
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`w-full ${getSizeClass()} relative z-[101] ${
              isDark
                ? 'bg-slate-800 border border-slate-700 text-white shadow-2xl shadow-black/50 rounded-3xl'
                : 'bg-white rounded-[2.5rem] shadow-2xl'
            } p-6 sm:p-8 overflow-hidden ${!children ? 'text-center' : ''}`}
            style={children ? { maxHeight: '90vh', display: 'flex', flexDirection: 'column' } : {}}
          >
            <button 
              onClick={onClose}
              className={`absolute top-6 right-6 ${
                isDark 
                  ? 'text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700' 
                  : 'text-slate-400 hover:text-slate-600'
              } transition-colors z-10 p-1.5 rounded-full`}
            >
              <X size={20} />
            </button>

            {children ? (
              <div className="flex flex-col h-full overflow-hidden">
                <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'} mb-6 pr-8 flex-shrink-0`}>{title}</h3>
                <div className="w-full overflow-y-auto overflow-x-hidden flex-1 scrollbar-hide">
                  {children}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-2">
                  {getIcon()}
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-900">{title}</h3>
                  {message && (
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                      {message}
                    </p>
                  )}
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
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
