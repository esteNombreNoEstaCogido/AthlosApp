import React, { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';

/**
 * 🚪 Back Button Exit Handler
 * Intelligent double-tap exit with graceful warning
 * Features:
 * - Detects back button press (browser + mobile)
 * - Shows toast warning: "Pulsa de nuevo para salir"
 * - 2-second window for second tap
 * - Exits gracefully on confirmation
 */

export const BackButtonExitHandler = ({ onExit = () => {}, isEnabled = true }) => {
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const exitTimeoutRef = useRef(null);
  const tapCountRef = useRef(0);

  useEffect(() => {
    if (!isEnabled) return;

    // Handle Android back button
    const handleBackButton = (e) => {
      e.preventDefault();
      handleExitPress();
    };

    // Handle browser back button
    const handlePopState = (e) => {
      e.preventDefault();
      handleExitPress();
    };

    // Listen for back navigation attempts
    window.addEventListener('popstate', handlePopState);
    
    // For mobile: capture back button via history push
    window.history.pushState(null, null, window.location.href);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
    };
  }, [isEnabled]);

  const handleExitPress = () => {
    if (exitTimeoutRef.current) {
      clearTimeout(exitTimeoutRef.current);
    }

    tapCountRef.current += 1;

    if (tapCountRef.current === 1) {
      // First tap: show warning
      setToastMessage('👆 Pulsa de nuevo para salir...');
      setShowExitPrompt(true);

      // Reset count after 2 seconds
      exitTimeoutRef.current = setTimeout(() => {
        tapCountRef.current = 0;
        setShowExitPrompt(false);
        setToastMessage('');
      }, 2000);
    } else if (tapCountRef.current === 2) {
      // Second tap: exit
      clearTimeout(exitTimeoutRef.current);
      performExit();
    }
  };

  const performExit = () => {
    setShowExitPrompt(false);
    setToastMessage('');
    tapCountRef.current = 0;

    // Call parent callback
    onExit();

    // Attempt different exit methods
    try {
      // Method 1: Close window (works on PWA/standalone)
      if (window.parent === window) {
        window.close();
      } else {
        // Method 2: Navigate to blank (works on web)
        window.location.href = 'about:blank';
      }
    } catch (err) {
      console.log('Exit method not supported in this context');
    }
  };

  return (
    <>
      {/* Exit Toast Notification */}
      {showExitPrompt && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-amber-500 text-black px-6 py-3 rounded-full font-bold flex items-center gap-2 shadow-2xl">
            <LogOut size={18} />
            {toastMessage}
          </div>
        </div>
      )}
    </>
  );
};

/**
 * Hook to manually trigger exit handler
 */
export const useBackButtonExit = () => {
  const [taps, setTaps] = useState(0);
  const timeoutRef = useRef(null);

  const handleTap = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    setTaps(prev => {
      const newTaps = prev + 1;
      if (newTaps === 2) {
        performExit();
        return 0;
      }
      timeoutRef.current = setTimeout(() => setTaps(0), 2000);
      return newTaps;
    });
  };

  const performExit = () => {
    try {
      window.close();
    } catch (err) {
      window.location.href = 'about:blank';
    }
  };

  return { handleTap, taps };
};
