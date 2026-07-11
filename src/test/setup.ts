import { vi } from 'vitest';

Object.defineProperty(globalThis, 'chrome', {
  configurable: true,
  value: {
    runtime: { sendMessage: vi.fn() },
    storage: {
      sync: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn(),
        onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      local: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
        onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      session: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
        onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      },
    },
    tabs: { sendMessage: vi.fn() },
  },
});
