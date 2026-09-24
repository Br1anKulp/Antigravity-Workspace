/**
 * Native Web Haptics Utility
 * Provides subtle tactile feedback on mobile devices (especially Android)
 * Gracefully no-ops on desktop or unsupported devices.
 */

export const isHapticsSupported = (): boolean => {
  return typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function';
};

/**
 * 8ms subtle tap: Ideal for tab switching, segmented controls, small button presses
 */
export const hapticLight = (): void => {
  try {
    if (isHapticsSupported()) {
      navigator.vibrate(8);
    }
  } catch {
    // Ignore any browser security restrictions
  }
};

/**
 * 15ms medium tap: Ideal for opening drawers, speed dial FAB expansion, toggling filters
 */
export const hapticMedium = (): void => {
  try {
    if (isHapticsSupported()) {
      navigator.vibrate(15);
    }
  } catch {
    // Ignore
  }
};

/**
 * Double-pulse pattern [10, 30, 20]: Ideal for completing tasks, checking off shopping items, saving
 */
export const hapticSuccess = (): void => {
  try {
    if (isHapticsSupported()) {
      navigator.vibrate([10, 30, 20]);
    }
  } catch {
    // Ignore
  }
};

/**
 * Double buzz [20, 50, 20]: Ideal for deletions, errors, undo actions
 */
export const hapticWarning = (): void => {
  try {
    if (isHapticsSupported()) {
      navigator.vibrate([20, 50, 20]);
    }
  } catch {
    // Ignore
  }
};
