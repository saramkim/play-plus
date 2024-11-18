import { getStorage, setStorage, StorageChanges, SubtitleConfig } from '../utils/storage';
import { Toggle } from '../components/toggle';
import { SETTINGS } from '../utils/constants';
import { ColorPicker } from '../components/colorPicker';
import { DEFAULT_SUBTITLE_CONFIG } from '../utils/default';
import { resetInputValue, setButtonAvailabilityWithTag, setElementVisibility, updateDefaultValue } from '../utils/dom';
import { validateAll } from '../utils/validation';
import { Checkbox } from '../components/checkbox';
import { NumberInput } from '../components/numberInput';

const { SUBTITLES } = SETTINGS;

export function onSubtitleStorageChange(changes: StorageChanges) {
  for (const { STORAGE_KEY, CONTAINER_ID } of Object.values(SUBTITLES)) {
    const subtitleChanges = changes[STORAGE_KEY];

    if (subtitleChanges && subtitleChanges.newValue) {
      setElementVisibility(CONTAINER_ID, subtitleChanges.newValue.enabled);
    }
  }
}

export async function initializeSubtitleSetting() {
  for (const [key, metadata] of Object.entries(SUBTITLES)) {
    const { STORAGE_KEY, CONTAINER_ID, TOGGLE_ID, INPUTS, BUTTONS } = metadata;
    const data = (await getStorage(STORAGE_KEY)) || DEFAULT_SUBTITLE_CONFIG;
    const settings = new Proxy(data, createSubtitleProxyHandler(key));
    const inputInstances: Record<string, HTMLInputElement> = {};

    setElementVisibility(CONTAINER_ID, settings.enabled);

    Toggle({ id: TOGGLE_ID, isOn: settings.enabled, onChange: (enabled) => (settings.enabled = enabled) });

    Object.entries(INPUTS).forEach(([storageKey, inputId]) => {
      inputInstances[storageKey] = createInput(inputId, storageKey, settings);
    });

    document.getElementById(BUTTONS.CANCEL)?.addEventListener('click', () => {
      Object.values(INPUTS).forEach((id) => resetInputValue(id));
      updateButtonsVisibility(key, false);
    });

    document.getElementById(BUTTONS.SAVE)?.addEventListener('click', async () => {
      await setStorage(STORAGE_KEY, settings);
      updateButtonsVisibility(key, false);

      Object.keys(INPUTS).forEach((storageKey) => {
        updateDefaultValue(inputInstances[storageKey], settings[storageKey]);
      });
    });
  }
}

function createSubtitleProxyHandler(key: keyof typeof SUBTITLES) {
  return {
    set(target: SubtitleConfig, prop: keyof SubtitleConfig, value: SubtitleConfig[keyof SubtitleConfig]) {
      const { STORAGE_KEY, BUTTONS } = SUBTITLES[key];
      if (prop === 'enabled') {
        setStorage(STORAGE_KEY, { ...target, enabled: value as boolean });
      } else {
        const result = validateAll(target, prop, value);
        setButtonAvailabilityWithTag(BUTTONS.SAVE, result);
        updateButtonsVisibility(key, true);
      }
      return Reflect.set(target, prop, value);
    },

    get(target: SubtitleConfig, prop: keyof SubtitleConfig) {
      if (target[prop] !== undefined) return Reflect.get(target, prop);
      return DEFAULT_SUBTITLE_CONFIG[prop];
    },
  };
}

function createInput(inputId: string, storageKey: keyof Omit<SubtitleConfig, 'enabled'>, settings: SubtitleConfig) {
  switch (storageKey) {
    case 'color':
      return ColorPicker({
        id: inputId,
        color: settings[storageKey],
        onChange: (newColor) => {
          settings[storageKey] = newColor;
        },
      });
    case 'lineBreak':
      return Checkbox({
        id: inputId,
        checked: settings[storageKey],
        onChange: (checked) => {
          settings[storageKey] = checked;
        },
      });
    default:
      return NumberInput({
        id: inputId,
        value: settings[storageKey],
        onChange: (newValue) => {
          settings[storageKey] = newValue;
        },
      });
  }
}

function updateButtonsVisibility(key: keyof typeof SUBTITLES, visible: boolean) {
  const { BUTTONS, TOGGLE_ID } = SUBTITLES[key];
  setElementVisibility(BUTTONS.CANCEL, visible);
  setElementVisibility(BUTTONS.SAVE, visible);
  setElementVisibility(TOGGLE_ID, !visible);
}
