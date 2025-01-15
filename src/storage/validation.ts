import { getMessage } from '../utils/i18n';
import { StorageSchema, StorageKey } from './type';
import { DEFAULT_CONFIG } from './default';

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
        throw new Error(`${getMessage('error_type_mismatch')}\n${getMessageByKey(k)}`);
      }
    } else if (typeof defaultValue === 'object' && defaultValue !== null) {
      if (typeof actualValue !== 'object' || actualValue === null) {
        throw new Error(`${getMessage('error_type_mismatch')}\n${getMessageByKey(k)}`);
      }
      validateType(actualValue as any, defaultValue as any);
    } else if (typeof actualValue !== typeof defaultValue) {
      if (typeof defaultValue === 'string') {
        throw new Error(`${getMessage('error_text_type')}\n${getMessageByKey(k)}`);
      }
      if (typeof defaultValue === 'number') {
        throw new Error(`${getMessage('error_number_type')}\n${getMessageByKey(k)}`);
      }
      throw new Error(`${getMessage('error_type_mismatch')}\n${getMessageByKey(k)}`);
    } else if (typeof defaultValue === 'number') {
      if (isNaN(actualValue as number)) {
        throw new Error(`${getMessage('error_number_type')}\n${getMessageByKey(k)}`);
      }
    }
  });
}

function validateDuplicateShortcuts<K extends StorageKey>(data: StorageSchema[K], existingShortcuts: string[]): void {
  const otherShortcuts = [...existingShortcuts];

  Object.entries(data).forEach(([key, value]) => {
    if (SHORTCUT_DATA_KEYS.includes(key) && typeof value === 'string' && value !== '') {
      if (otherShortcuts.includes(value))
        throw new Error(`${getMessage('error_duplicate_shortcuts')}\n${getMessageByKey(key)}`);
      if (RESERVED_SHORTCUTS.includes(value))
        throw new Error(`${getMessage('error_reserved_shortcuts')}\n${getMessageByKey(key)}`);

      otherShortcuts.push(value);
    }
  });
}

const getMessageByKey = (key: KeyOfUnion<StorageSchema[StorageKey]>) => {
  return {
    forward: getMessage('forward_key'),
    backward: getMessage('backward_key'),
    savePrimary: getMessage('save_primary_subtitle'),
    saveSecondary: getMessage('save_secondary_subtitle'),
    togglePrimary: getMessage('toggle_primary_subtitle'),
    toggleSecondary: getMessage('toggle_secondary_subtitle'),
    enabled: 'enabled',
    skipTime: getMessage('skip_unit'),
    skipTimeUnit: getMessage('skip_unit'),
    fallbackTime: getMessage('fallback_unit'),
    fallbackUnit: getMessage('fallback_unit'),
    language: getMessage('language'),
    positionReference: getMessage('position_reference'),
    positionOffset: getMessage('position_offset'),
    color: getMessage('subtitle_color'),
    fontSize: getMessage('subtitle_size'),
    fontWeight: getMessage('font_weight'),
    opacity: getMessage('opacity'),
    lineBreak: getMessage('allow_line_break'),
    videoSkip: getMessage('video_skip'),
    subVideoSkip: getMessage('sub_video_skip'),
    shortcuts: getMessage('shortcuts'),
    primarySubtitle: getMessage('primary_subtitle'),
    secondarySubtitle: getMessage('secondary_subtitle'),
    toggleLoop: getMessage('toggle_loop_key'),
    startPoint: getMessage('start_point_key'),
    endPoint: getMessage('end_point_key'),
    loopCurrentSubtitle: getMessage('loop_current_subtitle'),
  }[key];
};
