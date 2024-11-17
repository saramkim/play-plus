import { getStorage, setStorage, StorageChanges, SubtitleConfig } from '../utils/storage';
import { Toggle } from '../components/toggle';
import { SUBTITLES } from '../utils/constants';
import { ColorPicker } from '../components/colorPicker';
import { DEFAULT_SUBTITLE_CONFIG } from '../utils/default';
import { resetInputValue, setButtonAvailabilityWithTag, setElementVisibility, setupInput } from '../utils/dom';
import { validateAll } from '../utils/validation';

const subtitleSettings = Object.keys(SUBTITLES).reduce((acc, key) => {
  acc[key] = new Proxy(DEFAULT_SUBTITLE_CONFIG, createSubtitleProxyHandler(key));
  return acc;
}, {} as Record<keyof typeof SUBTITLES, SubtitleConfig>);

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
    const {
      STORAGE_KEY,
      CONTAINER_ID,
      TOGGLE_ID,
      COLOR_PICKER_ID,
      FONT_SIZE_INPUT_ID,
      FONT_WEIGHT_INPUT_ID,
      OPACITY_INPUT_ID,
      CANCEL_BUTTON_ID,
      SAVE_BUTTON_ID,
    } = metadata;
    const subtitle = await getStorage(STORAGE_KEY);
    if (subtitle) subtitleSettings[key] = new Proxy(subtitle, createSubtitleProxyHandler(key));

    const { enabled, color, fontSize, fontWeight, opacity } = subtitleSettings[key];

    setElementVisibility(CONTAINER_ID, enabled);

    Toggle({
      id: TOGGLE_ID,
      isOn: enabled,
      onChange: async (enabled) => {
        subtitleSettings[key].enabled = enabled;
      },
    });

    ColorPicker({
      id: COLOR_PICKER_ID,
      color: color,
      onChange: (color) => {
        subtitleSettings[key].color = color;
      },
    });

    const fontSizeInput = setupInput(FONT_SIZE_INPUT_ID, fontSize.toString());
    fontSizeInput.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement;
      subtitleSettings[key].fontSize = parseInt(target.value, 10);
    });

    const fontWeightInput = setupInput(FONT_WEIGHT_INPUT_ID, fontWeight.toString());
    fontWeightInput.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement;
      subtitleSettings[key].fontWeight = parseInt(target.value, 10);
    });

    const opacityInput = setupInput(OPACITY_INPUT_ID, opacity.toString());
    opacityInput.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement;
      subtitleSettings[key].opacity = parseInt(target.value, 10);
    });

    document.getElementById(CANCEL_BUTTON_ID)?.addEventListener('click', async () => {
      resetInputsValue(key);
      updateButtonsVisibility(key, false);
    });

    document.getElementById(SAVE_BUTTON_ID)?.addEventListener('click', async () => {
      await setStorage(STORAGE_KEY, subtitleSettings[key]);
      updateButtonsVisibility(key, false);
    });
  }
}

function createSubtitleProxyHandler(key: keyof typeof SUBTITLES) {
  return {
    set(target: SubtitleConfig, prop: keyof SubtitleConfig, value: SubtitleConfig[keyof SubtitleConfig]) {
      const { STORAGE_KEY, SAVE_BUTTON_ID } = SUBTITLES[key];
      if (prop === 'enabled') {
        setStorage(STORAGE_KEY, { ...target, enabled: value as boolean });
      } else {
        const result = validateAll(target, prop, value);
        setButtonAvailabilityWithTag(SAVE_BUTTON_ID, result);
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

function resetInputsValue(key: keyof typeof SUBTITLES) {
  const { COLOR_PICKER_ID, FONT_SIZE_INPUT_ID, FONT_WEIGHT_INPUT_ID, OPACITY_INPUT_ID } = SUBTITLES[key];
  resetInputValue(COLOR_PICKER_ID);
  resetInputValue(FONT_SIZE_INPUT_ID);
  resetInputValue(FONT_WEIGHT_INPUT_ID);
  resetInputValue(OPACITY_INPUT_ID);
}

function updateButtonsVisibility(key: keyof typeof SUBTITLES, visible: boolean) {
  const { TOGGLE_ID, CANCEL_BUTTON_ID, SAVE_BUTTON_ID } = SUBTITLES[key];
  setElementVisibility(CANCEL_BUTTON_ID, visible);
  setElementVisibility(SAVE_BUTTON_ID, visible);
  setElementVisibility(TOGGLE_ID, !visible);
}
