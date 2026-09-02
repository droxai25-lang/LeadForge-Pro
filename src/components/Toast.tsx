import type React from "react";
import { useEffect } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

export interface ToastMessage {
  id: string;
  type: "success" | "warning" | "error" | "info";
  title: string;
  description?: string;
  duration?: number;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div
      className="fixed bottom-14 right-5 z-50 flex flex-col space-y-2.5 max-w-sm w-full pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration || 4500);

    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const getTheme = () => {
    switch (toast.type) {
      case "success":
        return {
          border: "border-emerald-500/50",
          bg: "bg-[#0b1613]",
          iconBg: "bg-emerald-950/80 text-emerald-400 border border-emerald-800",
          icon: <CheckCircle2 className="w-4 h-4" />,
          titleColor: "text-emerald-300",
          indicator: "bg-emerald-500"
        };
      case "warning":
        return {
          border: "border-amber-500/50",
          bg: "bg-[#181308]",
          iconBg: "bg-amber-950/80 text-amber-400 border border-amber-800",
          icon: <AlertTriangle className="w-4 h-4" />,
          titleColor: "text-amber-300",
          indicator: "bg-amber-500"
        };
      case "error":
        return {
          border: "border-rose-500/50",
          bg: "bg-[#190d11]",
          iconBg: "bg-rose-950/80 text-rose-400 border border-rose-800",
          icon: <XCircle className="w-4 h-4" />,
          titleColor: "text-rose-300",
          indicator: "bg-rose-500"
        };
      default:
        return {
          border: "border-indigo-500/50",
          bg: "bg-[#0f1523]",
          iconBg: "bg-indigo-950/80 text-indigo-400 border border-indigo-800",
          icon: <Info className="w-4 h-4" />,
          titleColor: "text-indigo-300",
          indicator: "bg-indigo-500"
        };
    }
  };

  const theme = getTheme();

  return (
    <div
      className={`pointer-events-auto flex items-start space-x-3 p-3.5 rounded-xl border ${theme.border} ${theme.bg} shadow-2xl backdrop-blur-md transition-all duration-200 animate-in slide-in-from-bottom-2 fade-in relative overflow-hidden`}
    >
      <div className={`p-1.5 rounded-lg shrink-0 ${theme.iconBg}`}>{theme.icon}</div>

      <div className="flex-1 min-w-0 pr-1">
        <h4 className={`text-xs font-bold ${theme.titleColor} tracking-tight`}>{toast.title}</h4>
        {toast.description && (
          <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed font-sans">{toast.description}</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="text-slate-500 hover:text-slate-300 p-1 rounded-md transition cursor-pointer shrink-0"
        title="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Subtle bottom progress line */}
      <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${theme.indicator} opacity-40 animate-pulse`} />
    </div>
  );
};
