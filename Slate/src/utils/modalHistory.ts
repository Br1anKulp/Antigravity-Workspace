import { useEffect, useRef } from 'react';

interface ModalInstance {
  id: string;
  close: () => void;
}

const activeModals: ModalInstance[] = [];
let isNavigatingBack = false;
let unwindTimer: ReturnType<typeof setTimeout> | null = null;

if (typeof window !== 'undefined') {
  // If the user refreshed or loaded with a stale #modal hash, clean it up immediately
  if (window.location.hash.includes('#modal')) {
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch {
      // Ignore
    }
  }

  const onPopOrHashChange = () => {
    // If this back navigation was triggered programmatically by us unwinding the stack, ignore it
    if (isNavigatingBack) {
      isNavigatingBack = false;
      return;
    }

    if (activeModals.length > 0) {
      // Pop the topmost active modal
      const top = activeModals.pop();
      if (top) {
        top.close();
      }

      // If other modals are still open underneath (e.g. DayDetail was below EventModal),
      // re-push #modal so the NEXT Android back press closes the next modal instead of exiting the app
      if (activeModals.length > 0) {
        try {
          window.history.pushState({ modal: true }, '', '#modal');
        } catch {
          // Ignore
        }
      }
    }
  };

  window.addEventListener('popstate', onPopOrHashChange);
  window.addEventListener('hashchange', onPopOrHashChange);
}

/**
 * Register an active modal with the mobile back button navigation system.
 */
export function registerModal(id: string, close: () => void) {
  // Cancel any pending history unwind from a modal that just closed
  if (unwindTimer) {
    clearTimeout(unwindTimer);
    unwindTimer = null;
  }

  // If this is the first modal opening, push history state with #modal
  if (activeModals.length === 0) {
    if (!window.location.hash.includes('#modal')) {
      try {
        window.history.pushState({ modal: true }, '', '#modal');
      } catch {
        // Ignore
      }
    }
  }

  // Remove any previous registration of the same modal id
  const existingIndex = activeModals.findIndex(m => m.id === id);
  if (existingIndex !== -1) {
    activeModals.splice(existingIndex, 1);
  }

  activeModals.push({ id, close });
}

/**
 * Unregister a modal when it is closed via UI (e.g. Save, Cancel, Backdrop, X button).
 */
export function unregisterModal(id: string) {
  const index = activeModals.findIndex(m => m.id === id);
  if (index !== -1) {
    activeModals.splice(index, 1);
  }

  // If no more modals are open, debounced unwind the #modal history entry
  if (activeModals.length === 0) {
    if (unwindTimer) clearTimeout(unwindTimer);
    unwindTimer = setTimeout(() => {
      if (activeModals.length === 0 && window.location.hash.includes('#modal')) {
        isNavigatingBack = true;
        try {
          window.history.back();
        } catch {
          isNavigatingBack = false;
        }
      }
    }, 40);
  }
}

/**
 * Hook to handle Android hardware back button and browser back navigation.
 * When modal is open, pushes '#modal' to window.history.
 * When back is pressed (system gesture or hardware button), Android navigates back within the PWA
 * and popstate / hashchange is intercepted to close the modal instead of exiting the app.
 * When modal is closed via UI, the history state is popped programmatically.
 */
export function useModalBackHandler(isOpen: boolean, onClose: () => void, modalId = 'modal') {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const idRef = useRef(`${modalId}-${Math.random().toString(36).slice(2, 7)}`);

  useEffect(() => {
    const id = idRef.current;
    if (isOpen) {
      registerModal(id, () => {
        onCloseRef.current();
      });
    } else {
      unregisterModal(id);
    }

    return () => {
      unregisterModal(id);
    };
  }, [isOpen]);
}
