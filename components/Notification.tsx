
import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X, HelpCircle } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: NotificationType;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const config = {
    success: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    error: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
    info: { icon: Info, color: 'text-brand-400', bg: 'bg-brand-500/10', border: 'border-brand-500/20' },
  }[type];

  const Icon = config.icon;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-top-4 duration-300">
      <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl ${config.bg} ${config.border} border backdrop-blur-xl shadow-2xl min-w-[280px]`}>
        <Icon className={config.color} size={20} />
        <span className="text-sm font-bold text-slate-200">{message}</span>
        <button onClick={onClose} className="ml-auto text-slate-500 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

interface ConfirmDialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ title, message, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300" onClick={onCancel}></div>
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700/50 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-8 text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-brand-500/20 rounded-2xl flex items-center justify-center text-brand-400">
            <HelpCircle size={32} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white">{title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="p-6 bg-slate-850/50 border-t border-slate-800 flex gap-3">
          <button 
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold text-sm transition-all"
          >
            取消操作
          </button>
          <button 
            onClick={onConfirm}
            className="flex-1 px-4 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-brand-500/20 transition-all active:scale-[0.98]"
          >
            确认执行
          </button>
        </div>
      </div>
    </div>
  );
};
