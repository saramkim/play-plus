import { useEffect } from 'react';
import type { z } from 'zod';

import { zodResolver } from '@hookform/resolvers/zod';
import { storageSchema } from '@storage/schema';
import { StorageKey, StorageSchema } from '@storage/type';
import { useForm, DefaultValues } from 'react-hook-form';

import { useConfigStore } from '@/ui/store/config-store';

export const useConfigForm = <K extends StorageKey>(key: K) => {
  const { configs, setConfig } = useConfigStore();
  const config = configs[key];
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
