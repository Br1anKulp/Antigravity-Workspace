const memStorage: Record<string, string> = {};

export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (err) {
      console.warn(`LocalStorage read failed for key "${key}", falling back to in-memory:`, err);
      return memStorage[key] || null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      console.warn(`LocalStorage write failed for key "${key}", falling back to in-memory:`, err);
      memStorage[key] = value;
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.warn(`LocalStorage delete failed for key "${key}", falling back to in-memory:`, err);
      delete memStorage[key];
    }
  }
};

// Simple encryption/obfuscation using a key (like user's UID) to avoid plaintext token in localStorage
const xorEncrypt = (text: string, key: string): string => {
  if (!key) return text;
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(encodeURIComponent(result));
};

const xorDecrypt = (encoded: string, key: string): string => {
  if (!key) return encoded;
  try {
    const text = decodeURIComponent(atob(encoded));
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch {
    return '';
  }
};

export const safeTokenStorage = {
  getToken: (uid?: string): string | null => {
    const raw = safeStorage.getItem('slate_google_token');
    if (!raw) return null;
    if (!uid) return raw;
    return xorDecrypt(raw, uid);
  },
  setToken: (token: string, uid?: string): void => {
    if (!uid) {
      safeStorage.setItem('slate_google_token', token);
      return;
    }
    const encrypted = xorEncrypt(token, uid);
    safeStorage.setItem('slate_google_token', encrypted);
  },
  removeToken: (): void => {
    safeStorage.removeItem('slate_google_token');
  }
};
