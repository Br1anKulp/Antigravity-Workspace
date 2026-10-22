import { useEffect, useRef } from 'react';

/**
 * Hook to handle Android hardware back button and browser back navigation.
 * When modal is open, pushes a state to window.history.
 * When back is pressed (system gesture or hardware button), popstate event is intercepted
 * to close the modal instead of navigating away or exiting the app.
 * When modal is closed via UI, the history state is popped programmatically.
 */
export function useModalBackHandler(isOpen: boolean, onClose: () => void, modalId = 'modal') {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const isPushedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    const stateKey = `modal_${modalId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    try {
      window.history.pushState({ slateModal: stateKey }, '');
      isPushedRef.current = true;
    } catch {
      // In case history API is restricted in sandboxed iframes
      isPushedRef.current = false;
    }

    const handlePopState = () => {
      if (isPushedRef.current) {
        isPushedRef.current = false;
        onCloseRef.current();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (isPushedRef.current) {
        isPushedRef.current = false;
        try {
          if (window.history.state && window.history.state.slateModal === stateKey) {
            window.history.back();
          }
        } catch {
          // Ignore
        }
      }
    };
  }, [isOpen, modalId]);
}
