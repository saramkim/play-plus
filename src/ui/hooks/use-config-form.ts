import { useEffect, useState } from 'react';
import * as z from 'zod';

import { zodResolver } from '@hookform/resolvers/zod';
import { DEFAULT_CONFIG } from '@storage/default';
import { getStorage, onStorageChange, setStorage } from '@storage/index';
import { storageSchema } from '@storage/schema';
import { StorageKey, StorageSchema } from '@storage/type';
import { useForm } from 'react-hook-form';

export const useConfigForm = <K extends StorageKey>(key: K) => {
  const [loading, setLoading] = useState(true);
  const form = useForm<StorageSchema[K]>({
    resolver: zodResolver(storageSchema[key] as unknown as z.ZodType<StorageSchema[K]>),
    defaultValues: async () => {
      const data = await getStorage(key);
      setLoading(false);
      return data;
    },
    mode: 'onChange',
  });

  useEffect(() => {
    const { remove } = onStorageChange((changes) => {
      const data = changes[key];
      if (data) {
        form.reset(data.newValue || DEFAULT_CONFIG[key]);
      }
    });
    return remove;
  }, []);

  const onSubmit = (data: StorageSchema[K]) => {
    return setStorage(key, data);
  };

  return { form, loading, onSubmit };
};
