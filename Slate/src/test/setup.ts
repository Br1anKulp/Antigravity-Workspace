import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('firebase/messaging', () => ({
  getMessaging: vi.fn(() => ({})),
  getToken: vi.fn().mockResolvedValue('mock-token'),
  onMessage: vi.fn().mockReturnValue(() => {}),
  isSupported: vi.fn().mockResolvedValue(false)
}));
