import { StorageSchema } from './storage';
import { getMessage } from './i18n';
import { StorageKey } from './storage';
import { DEFAULT_CONFIG } from './default';

const SHORTCUT_STORAGE_KEYS: StorageKey[] = ['shortcuts', 'videoSkip', 'subVideoSkip'];
const SHORTCUT_DATA_KEYS = ['forward', 'backward', 'savePrimary', 'saveSecondary', 'togglePrimary', 'toggleSecondary'];
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
    if (SHORTCUT_DATA_KEYS.includes(key) && typeof value === 'string') {
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
    forward: getMessage('forward_key_label'),
    backward: getMessage('backward_key_label'),
    savePrimary: getMessage('primary_subtitle_save_shortcuts_label'),
    saveSecondary: getMessage('secondary_subtitle_save_shortcuts_label'),
    togglePrimary: getMessage('primary_subtitle_toggle_shortcuts_label'),
    toggleSecondary: getMessage('secondary_subtitle_toggle_shortcuts_label'),
    enabled: '',
    skipTime: getMessage('video_skip_time_label'),
    skipTimeUnit: '',
    language: getMessage('language_label'),
    positionReference: getMessage('position_reference_label'),
    positionOffset: getMessage('position_offset_label'),
    color: getMessage('subtitle_color_label'),
    fontSize: getMessage('subtitle_font_size_label'),
    fontWeight: getMessage('subtitle_font_weight_label'),
    opacity: getMessage('subtitle_opacity_label'),
    lineBreak: getMessage('line_break_label'),
    videoSkip: getMessage('video_skip_section_title'),
    subVideoSkip: getMessage('sub_video_skip_section_title'),
    shortcuts: getMessage('shortcuts_section_title'),
    primarySubtitle: getMessage('primary_subtitle_section_title'),
    secondarySubtitle: getMessage('secondary_subtitle_section_title'),
  }[key];
};
