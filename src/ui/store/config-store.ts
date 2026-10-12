import { DEFAULT_CONFIG } from '@storage/default';
import { getStorageAll, onStorageChange, setStorage, validateStorageValue } from '@storage/index';
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
        if (!Object.keys(DEFAULT_CONFIG).includes(key)) return;
        const value = validateStorageValue(key, changes[key]!.newValue);
        set((state) => ({ configs: { ...state.configs, [key]: value } }));
      });
    });
  },
}));
