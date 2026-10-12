import { useState } from 'react';

import { CONTROL_COMMANDS, CONTROL_LABELS } from '@storage/v2/control-settings';
import { cn } from '@utils/helper';
import { t } from '@utils/i18n';
import { Minimize2Icon, SlidersVerticalIcon } from 'lucide-react';

import { useListeningMissionActiveStore } from '@/content/features/listening-session/mission-active-store';
import { usePlaybackSpeedStore } from '@/content/features/playback-speed/playback-speed-store';
import { getControlledMedia, isMediaContextAvailable } from '@/content/features/video/media-controls';
import { playbackRepetition, useRepetitionStore } from '@/content/features/video/playback-repetition';
import { useVideoControlStore, videoController } from '@/content/features/video/video-controller';
import { usePlaybackContextStore } from '@/content/playback-context/playback-context-store';

export function Controller({ className }: { className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [rangeError, setRangeError] = useState(false);
  const active = useListeningMissionActiveStore((state) => state.active);
  const status = usePlaybackContextStore((state) => state.status);
  const ready = useVideoControlStore((state) => state.ready);
  const repetition = useRepetitionStore();
  const speed = usePlaybackSpeedStore();
  const contextKey = JSON.stringify(status);
  if (!ready || active || !isMediaContextAvailable(status)) return null;
  return <div className={cn('absolute top-1/2 right-0 flex max-h-[80vh] -translate-y-1/2 flex-col overflow-y-auto rounded-lg bg-black/80 p-2 text-sm text-white shadow-lg pointer-events-auto', className)}>
    <button type='button' className='flex size-10 items-center justify-center self-end'
      aria-label={t(expanded ? 'v2_hide_learning_controls' : 'v2_show_learning_controls')}
      onClick={() => setExpanded((value) => !value)}>
      {expanded ? <Minimize2Icon /> : <SlidersVerticalIcon />}
    </button>
    {expanded && <div className='flex w-72 max-w-[80vw] flex-col gap-2'>
      <div className='grid grid-cols-2 gap-1'>
        {CONTROL_COMMANDS.map((command) => <button key={command} type='button' aria-label={t(CONTROL_LABELS[command])}
          className='rounded border border-white/30 p-2 text-wrap hover:bg-white/20 focus-visible:outline-2'
          onClick={() => void videoController.execute(command)}>{t(CONTROL_LABELS[command])}</button>)}
      </div>
      <fieldset className='flex flex-wrap gap-2 border border-white/30 p-2'>
        <legend>{t('v2_loop_status')}</legend>
        {(['start', 'end'] as const).map((point) => <label key={point} className='flex items-center gap-1'>
          {point === 'start' ? 'A' : 'B'}
          <RepetitionPointInput key={JSON.stringify([point, contextKey, repetition.start, repetition.end])}
            value={repetition[point]} onCommit={(value) => {
            const current = useRepetitionStore.getState();
            if (contextKey !== JSON.stringify(usePlaybackContextStore.getState().status) ||
              current.start !== repetition.start || current.end !== repetition.end) return;
            setRangeError(value === null || !playbackRepetition.setPoint(point, value));
          }} />
        </label>)}
        <span role='status'>{t(repetition.mode === 'once' ? 'v2_once_active' : repetition.mode ? 'v2_loop_active' : 'v2_loop_inactive')}</span>
        {rangeError && <p role='alert'>{t('v2_invalid_playback_range')}</p>}
      </fieldset>
      <div className='flex flex-wrap gap-2'>
        {([['decrease_speed', speed.decreaseSpeed], ['reset_speed', speed.resetSpeed], ['increase_speed', speed.increaseSpeed]] as const)
          .map(([label, action]) => <button key={label} type='button' className='rounded border border-white/30 p-2'
            onClick={() => { if (getControlledMedia()) action(); }}>{t(label)}</button>)}
        <span>{speed.currentSpeed.toFixed(1)}×</span>
      </div>
    </div>}
  </div>;
}

function RepetitionPointInput({ value, onCommit }: { value: number | null; onCommit: (value: number | null) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return <input type='number' min='0' step='0.1' className='w-24 rounded bg-black p-1'
    value={draft ?? value ?? ''} onChange={(event) => setDraft(event.target.value)}
    onBlur={(event) => {
      if (draft !== null) onCommit(event.target.value === '' ? null : Number(event.target.value));
      setDraft(null);
    }} onKeyDown={(event) => {
      if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); event.currentTarget.blur(); }
    }} />;
}
