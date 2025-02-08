import { useState, useEffect, useRef } from 'react';
import { getStorage, onStorageChange, setStorage } from '../storage/storage';
import { DEFAULT_CONFIG } from '../storage/default';
import { usePopup } from '../contexts/PopupContext';
import MessagePopup from '../components/MessagePopup';
import { t } from '../utils/i18n';
import { StorageSchema, StorageKey } from '../storage/type';

function useConfig<K extends StorageKey>(key: K) {
  const [state, setState] = useState<StorageSchema[K]>(DEFAULT_CONFIG[key]);
  const [hasChanged, setHasChanged] = useState(false);
  const originalState = useRef<StorageSchema[K]>(DEFAULT_CONFIG[key]);
  const { showPopup, hidePopup } = usePopup();

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
      showPopup({
        title: t('error'),
        content: <MessagePopup message={response.error.message} type='alert' hidePopup={hidePopup} />,
        status: 'error',
      });
    }
  };

  const handleCancel = () => {
    setState(originalState.current);
    setHasChanged(false);
  };

  return { state, hasChanged, handleChange, handleSave, handleCancel };
}

export default useConfig;
