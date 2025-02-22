import { t } from '@utils/i18n';
import { DEFAULT_CONFIG } from './default';
import { StorageKey, StorageSchema } from './type';

const SHORTCUT_STORAGE_KEYS: StorageKey[] = ['shortcuts', 'videoSkip', 'subVideoSkip', 'loop'];
const SHORTCUT_DATA_KEYS: KeyOfUnion<StorageSchema[StorageKey]>[] = [
  'forward',
  'backward',
  'savePrimary',
  'saveSecondary',
  'togglePrimary',
  'toggleSecondary',
  'toggleLoop',
  'startPoint',
  'endPoint',
  'loopCurrentSubtitle',
];
const RESERVED_SHORTCUTS = ['ArrowUp', 'ArrowDown', 'Enter', 'Space', 'Escape', 'KeyF', 'KeyM'];

export const validate = <K extends StorageKey>(
  storageCache: Map<StorageKey, StorageSchema[StorageKey]>,
  key: K,
  value: StorageSchema[K]
) => {
  validateType(key, value);
  if (SHORTCUT_STORAGE_KEYS.includes(key)) {
    const existingShortcuts = getExistingShortcuts(storageCache, key);
    validateDuplicateShortcuts(value, existingShortcuts);
  }
};

const getExistingShortcuts = (storageCache: Map<StorageKey, StorageSchema[StorageKey]>, exceptKey: StorageKey) => {
  const existingShortcuts: string[] = [];
  SHORTCUT_STORAGE_KEYS.filter((storageKey) => storageKey !== exceptKey).forEach((key) => {
    const config = storageCache.get(key);
    if (config) {
      Object.entries(config).forEach(([k, v]) => {
        if (SHORTCUT_DATA_KEYS.includes(k) && typeof v === 'string' && v !== '') {
          existingShortcuts.push(v);
        }
      });
    }
  });
  return existingShortcuts;
};

function validateType<K extends StorageKey>(key: K, value: StorageSchema[K]) {
  Object.entries(DEFAULT_CONFIG[key]).forEach(([k, defaultValue]) => {
    const actualValue = value[k];

    if (Array.isArray(defaultValue)) {
      if (!defaultValue.includes(actualValue)) {
        throw new Error(`${t('error_type_mismatch')}\n${getMessageByKey(k)}`);
      }
    } else if (typeof defaultValue === 'object' && defaultValue !== null) {
      if (typeof actualValue !== 'object' || actualValue === null) {
        throw new Error(`${t('error_type_mismatch')}\n${getMessageByKey(k)}`);
      }
      validateType(actualValue as any, defaultValue as any);
    } else if (typeof actualValue !== typeof defaultValue) {
      if (typeof defaultValue === 'string') {
        throw new Error(`${t('error_text_type')}\n${getMessageByKey(k)}`);
      }
      if (typeof defaultValue === 'number') {
        throw new Error(`${t('error_number_type')}\n${getMessageByKey(k)}`);
      }
      throw new Error(`${t('error_type_mismatch')}\n${getMessageByKey(k)}`);
    } else if (typeof defaultValue === 'number') {
      if (isNaN(actualValue as number)) {
        throw new Error(`${t('error_number_type')}\n${getMessageByKey(k)}`);
      }
    }
  });
}

function validateDuplicateShortcuts<K extends StorageKey>(data: StorageSchema[K], existingShortcuts: string[]): void {
  const otherShortcuts = [...existingShortcuts];

  Object.entries(data).forEach(([key, value]) => {
    if (SHORTCUT_DATA_KEYS.includes(key) && typeof value === 'string' && value !== '') {
      if (otherShortcuts.includes(value)) throw new Error(`${t('error_duplicate_shortcuts')}\n${getMessageByKey(key)}`);
      if (RESERVED_SHORTCUTS.includes(value))
        throw new Error(`${t('error_reserved_shortcuts')}\n${getMessageByKey(key)}`);

      otherShortcuts.push(value);
    }
  });
}

const getMessageByKey = (key: KeyOfUnion<StorageSchema[StorageKey]>) => {
  return {
    forward: t('forward_key'),
    backward: t('backward_key'),
    savePrimary: t('save_primary_subtitle'),
    saveSecondary: t('save_secondary_subtitle'),
    togglePrimary: t('toggle_primary_subtitle'),
    toggleSecondary: t('toggle_secondary_subtitle'),
    enabled: 'enabled',
    skipTime: t('skip_unit'),
    skipTimeUnit: t('skip_unit'),
    fallbackTime: t('fallback_unit'),
    fallbackUnit: t('fallback_unit'),
    language: t('language'),
    positionReference: t('position_reference'),
    positionOffset: t('position_offset'),
    color: t('subtitle_color'),
    fontSize: t('subtitle_size'),
    fontWeight: t('font_weight'),
    opacity: t('opacity'),
    lineBreak: t('allow_line_break'),
    delay: t('sync_adjustment'),
    videoSkip: t('video_skip'),
    subVideoSkip: t('sub_video_skip'),
    shortcuts: t('shortcuts'),
    primarySubtitle: t('primary_subtitle'),
    secondarySubtitle: t('secondary_subtitle'),
    toggleLoop: t('toggle_loop_key'),
    startPoint: t('start_point_key'),
    endPoint: t('end_point_key'),
    loopCurrentSubtitle: t('loop_current_subtitle'),
  }[key];
};
