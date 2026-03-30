import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { Toast } from '@capacitor/toast';
import { Capacitor } from '@capacitor/core';

/**
 * Back Button Handler for Android (Capacitor)
 * - Sub-page: navigates back via onNavigateBack callback
 * - Home/Login: double-tap to exit with native toast
 */
export const BackButtonExitHandler = ({ 
  isEnabled = true, 
  canGoBack = false,
  onNavigateBack = () => {},
  onExit = () => {} 
}) => {
  const lastBackPress = useRef(0);

  useEffect(() => {
    if (!isEnabled) return;

    // Only register native listener on Android
    if (!Capacitor.isNativePlatform()) return;

    let listenerHandle = null;
    const setup = async () => {
      listenerHandle = await App.addListener('backButton', async ({ canGoBack: webCanGoBack }) => {
        if (canGoBack) {
          onNavigateBack();
          return;
        }

        const now = Date.now();
        if (now - lastBackPress.current < 2000) {
          onExit();
          await App.exitApp();
        } else {
          lastBackPress.current = now;
          await Toast.show({ text: 'Pulsa de nuevo para salir', duration: 'short' });
        }
      });
    };
    setup();

    return () => { if (listenerHandle) listenerHandle.remove(); };
  }, [isEnabled, canGoBack, onNavigateBack, onExit]);

  return null;
};
