import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

/**
 * 🔔 Toast Notification System
 * Non-intrusive notifications for user feedback
 */

export const Toast = ({ 
  message = '', 
  type = 'info', // 'success', 'error', 'warning', 'info'
  duration = 3000,
  onClose = () => {},
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  if (!isVisible) return null;

  const config = {
    success: {
      bg: '#10B981', // Green
      icon: CheckCircle2,
      text: '#FFFFFF',
    },
    error: {
      bg: '#EF4444', // Red
      icon: AlertCircle,
      text: '#FFFFFF',
    },
    warning: {
      bg: '#F59E0B', // Amber
      icon: AlertTriangle,
      text: '#000000',
    },
    info: {
      bg: '#3B82F6', // Blue
      icon: Info,
      text: '#FFFFFF',
    },
  };

  const cfg = config[type] || config.info;
  const IconComponent = cfg.icon;

  return (
    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
      <div 
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md border border-white/10"
        style={{ backgroundColor: cfg.bg, color: cfg.text }}
      >
        <IconComponent size={16} strokeWidth={2.5} />
        <p className="font-bold text-xs">{message}</p>
      </div>
    </div>
  );
};

/**
 * Toast Container for managing multiple toasts
 */
export const ToastContainer = ({ toasts = [] }) => {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((toast, idx) => (
        <div
          key={toast.id || idx}
          className="pointer-events-auto"
        >
          <Toast
            message={toast.message}
            type={toast.type}
            duration={toast.duration || 3000}
            onClose={toast.onClose}
          />
        </div>
      ))}
    </div>
  );
};

/**
 * useToast Hook for easy integration
 */
export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'info', duration = 3000) => {
    const id = Date.now();
    const newToast = {
      id,
      message,
      type,
      duration,
      onClose: () => {
        setToasts(prev => prev.filter(t => t.id !== id));
      },
    };

    setToasts(prev => [...prev, newToast]);

    return id;
  };

  const showSuccess = (message) => showToast(message, 'success', 3000);
  const showError = (message) => showToast(message, 'error', 4000);
  const showWarning = (message) => showToast(message, 'warning', 3000);
  const showInfo = (message) => showToast(message, 'info', 3000);

  return {
    toasts,
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
};
