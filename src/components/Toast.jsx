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
    <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div 
        className="flex items-center gap-3 px-6 py-4 rounded-lg shadow-xl backdrop-blur"
        style={{ backgroundColor: cfg.bg, color: cfg.text }}
      >
        <IconComponent size={20} strokeWidth={2} />
        <p className="font-semibold text-sm">{message}</p>
      </div>
    </div>
  );
};

/**
 * Toast Container for managing multiple toasts
 */
export const ToastContainer = ({ toasts = [] }) => {
  return (
    <>
      {toasts.map((toast, idx) => (
        <div
          key={idx}
          className="fixed bottom-4 right-4 z-50 mb-4"
          style={{ bottom: `${(idx + 1) * 80}px` }}
        >
          <Toast
            message={toast.message}
            type={toast.type}
            duration={toast.duration || 3000}
            onClose={toast.onClose}
          />
        </div>
      ))}
    </>
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
