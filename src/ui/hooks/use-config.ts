import { useEffect, useRef, useState } from 'react';

import { DEFAULT_CONFIG } from '@storage/default';
import { getStorage, onStorageChange, setStorage } from '@storage/index';
import { StorageKey, StorageSchema } from '@storage/type';
import { toast } from 'sonner';

export function useConfig<K extends StorageKey>(key: K) {
  const [state, setState] = useState<StorageSchema[K]>(DEFAULT_CONFIG[key]);
  const [hasChanged, setHasChanged] = useState(false);
  const originalState = useRef<StorageSchema[K]>(DEFAULT_CONFIG[key]);

  useEffect(() => {
    (async () => {
      const data = await getStorage(key);
      originalState.current = data;
      setState(originalState.current);
    })();

    const { remove } = onStorageChange((changes) => {
      const data = changes[key];
      if (data) {
        originalState.current = data.newValue || DEFAULT_CONFIG[key];
        setState(originalState.current);
      }
    });
    return () => remove();
  }, []);

  const handleChange =
    <F extends keyof StorageSchema[K]>(field: F) =>
    (value: StorageSchema[K][F]) => {
      if (field === 'enabled') {
        setStorage(key, { ...state, [field]: value });
      } else {
        setState((prev) => ({ ...prev, [field]: value }));
        setHasChanged(true);
      }
    };

  const handleSave = async () => {
    const response = await setStorage(key, state);
    if (response.success) {
      setHasChanged(false);
    } else {
      toast.error(response.error.message);
    }
  };

  const handleCancel = () => {
    setState(originalState.current);
    setHasChanged(false);
  };

  return { state, hasChanged, handleChange, handleSave, handleCancel };
}
