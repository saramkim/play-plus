import { getLocalStorage, onLocalStorageChange } from '@storage/index';
import { LocalStorageSchema } from '@storage/type';
import { useEffect, useState } from 'react';

type SubtitleStorageKey = 'savedSubtitles' | 'registeredSubtitles';

export function useSubtitles<T extends SubtitleStorageKey>(storageKey: T) {
  const [subtitles, setSubtitles] = useState<LocalStorageSchema[T]>([]);

  useEffect(() => {
    (async () => {
      const data = await getLocalStorage(storageKey);
      if (data) setSubtitles(data);
    })();

    const { remove } = onLocalStorageChange((changes) => {
      const change = changes[storageKey];
      if (change?.newValue) setSubtitles(change.newValue);
    });
    return remove;
  }, []);

  return { subtitles };
}
