import { DEFAULT_CONFIG } from '@storage/default';
import { getStorageAll, onStorageChange, setStorage } from '@storage/index';
import { StorageKey, StorageSchema } from '@storage/type';
import { create } from 'zustand';

interface ConfigState {
  configs: StorageSchema;
  loading: boolean;
  setConfig: <K extends StorageKey>(key: K, value: StorageSchema[K]) => Promise<void>;
  initializeConfigs: () => Promise<{ remove: () => void }>;
}

export const useConfigStore = create<ConfigState>((set) => ({
  configs: DEFAULT_CONFIG,
  loading: true,

  setConfig: async (key, value) => {
    await setStorage(key, value);
    set((state) => ({ configs: { ...state.configs, [key]: value } }));
  },

  initializeConfigs: async () => {
    const configs = await getStorageAll();
    set({ configs, loading: false });

    return onStorageChange((changes) => {
      Object.keys(changes).forEach((key) => {
        const value = changes[key]!.newValue || DEFAULT_CONFIG[key];
        set((state) => ({ configs: { ...state.configs, [key]: value } }));
      });
    });
  },
}));
