import { getStorage, setStorage, StorageChanges, SubtitleConfig } from '../utils/storage';
import { Toggle } from '../components/toggle';
import { SUBTITLES } from '../utils/constants';
import { ColorPicker } from '../components/colorPicker';
import { DEFAULT_SUBTITLE_CONFIG } from '../utils/default';
import { setButtonAvailabilityWithTag, setElementVisibility, setupInput } from '../utils/dom';
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
      SAVE_BUTTON_ID,
    } = metadata;
    const subtitle = await getStorage(STORAGE_KEY);
    if (subtitle) subtitleSettings[key] = new Proxy(subtitle, createSubtitleProxyHandler(key));

    const { enabled, color, fontSize, fontWeight } = subtitleSettings[key];

    setElementVisibility(CONTAINER_ID, enabled);

    const toggle = Toggle({
      isOn: enabled,
      onChange: async (enabled) => {
        subtitleSettings[key].enabled = enabled;
      },
    });
    document.getElementById(TOGGLE_ID)?.appendChild(toggle);

    const colorPicker = ColorPicker({
      id: `${COLOR_PICKER_ID}_input`,
      color: color,
      onChange: (color) => {
        subtitleSettings[key].color = color;
      },
    });
    document.getElementById(COLOR_PICKER_ID)?.appendChild(colorPicker);

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

    document.getElementById(SAVE_BUTTON_ID)?.addEventListener('click', async () => {
      await setStorage(STORAGE_KEY, subtitleSettings[key]);
      setElementVisibility(SAVE_BUTTON_ID, false);
      setElementVisibility(TOGGLE_ID, true);
    });
  }
}

function createSubtitleProxyHandler(key: keyof typeof SUBTITLES) {
  return {
    set(target: SubtitleConfig, prop: keyof SubtitleConfig, value: SubtitleConfig[keyof SubtitleConfig]) {
      const { STORAGE_KEY, TOGGLE_ID, SAVE_BUTTON_ID } = SUBTITLES[key];
      if (prop === 'enabled') {
        setStorage(STORAGE_KEY, { ...target, enabled: value as boolean });
      } else {
        const result = validateAll(target, prop, value);
        setButtonAvailabilityWithTag(SAVE_BUTTON_ID, result);
        setElementVisibility(TOGGLE_ID, false);
        setElementVisibility(SAVE_BUTTON_ID, true);
      }
      return Reflect.set(target, prop, value);
    },

    get(target: SubtitleConfig, prop: keyof SubtitleConfig) {
      if (target[prop]) return Reflect.get(target, prop);
      return DEFAULT_SUBTITLE_CONFIG[prop];
    },
  };
}
