import { useEffect } from 'react';
import type { z } from 'zod';

import { zodResolver } from '@hookform/resolvers/zod';
import { storageSchema } from '@storage/schema';
import { StorageKey, StorageSchema } from '@storage/type';
import { useForm, DefaultValues } from 'react-hook-form';
import { useShallow } from 'zustand/react/shallow';

import { useConfigStore } from '@/ui/store/config-store';

export const useConfigForm = <K extends StorageKey>(key: K) => {
  const config = useConfigStore(useShallow((state) => state.configs[key]));
  const setConfig = useConfigStore((state) => state.setConfig);

  const form = useForm<StorageSchema[K]>({
    resolver: zodResolver(storageSchema[key] as unknown as z.ZodType<StorageSchema[K]>),
    defaultValues: config as DefaultValues<StorageSchema[K]>,
    mode: 'onChange',
  });

  useEffect(() => {
    form.reset(config);
  }, [config, form]);

  const onSubmit = (data: StorageSchema[K]) => {
    return setConfig(key, data);
  };

  return { form, onSubmit };
};
