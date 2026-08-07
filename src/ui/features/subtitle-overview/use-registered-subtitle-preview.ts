import { useCallback, useEffect, useRef, useState } from 'react';

import { getLocalSubtitle, SubtitleId } from '@storage/subtitle';
import type { V2SubtitleCue } from '@storage/v2/type';

export type RegisteredSubtitlePreviewState =
  | { status: 'loading'; subtitleId: SubtitleId }
  | { status: 'ready'; subtitleId: SubtitleId; cues: V2SubtitleCue[] }
  | { status: 'unavailable'; subtitleId: SubtitleId }
  | { status: 'error'; subtitleId: SubtitleId };

export const useRegisteredSubtitlePreview = (
  subtitleId: SubtitleId,
  available: boolean
) => {
  const [reloadRevision, setReloadRevision] = useState(0);
  const [state, setState] = useState<RegisteredSubtitlePreviewState>({
    status: 'loading',
    subtitleId,
  });
  const generationRef = useRef(0);

  useEffect(() => {
    const generation = ++generationRef.current;
    if (!available) {
      setState({ status: 'unavailable', subtitleId });
      return;
    }

    setState({ status: 'loading', subtitleId });
    void getLocalSubtitle(subtitleId).then(
      (cues) => {
        if (generationRef.current !== generation) return;
        setState({ status: 'ready', subtitleId, cues });
      },
      () => {
        if (generationRef.current !== generation) return;
        setState({ status: 'error', subtitleId });
      }
    );

    return () => {
      if (generationRef.current === generation) generationRef.current += 1;
    };
  }, [available, reloadRevision, subtitleId]);

  const retry = useCallback(() => setReloadRevision((revision) => revision + 1), []);
  const viewState: RegisteredSubtitlePreviewState = !available
    ? { status: 'unavailable', subtitleId }
    : state.subtitleId === subtitleId
      ? state
      : { status: 'loading', subtitleId };

  return { retry, viewState };
};
