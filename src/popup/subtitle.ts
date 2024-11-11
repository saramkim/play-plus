import { getStorage, setStorage, SubtitleConfig } from '../utils/storage';
import { Toggle } from '../components/toggle';
import { SUBTITLES } from '../utils/constants';
import { ColorPicker } from '../components/colorPicker';
import { DEFAULT_SUBTITLE_CONFIG } from '../utils/default';
import { setElementVisibility, setupInput } from '../utils/dom';

const subtitleSettings = Object.keys(SUBTITLES).reduce((acc, key) => {
  acc[key] = new Proxy(DEFAULT_SUBTITLE_CONFIG, createSubtitleProxyHandler(key));
  return acc;
}, {} as Record<keyof typeof SUBTITLES, SubtitleConfig>);

export async function initializeSubtitleSetting() {
  for (const [key, metadata] of Object.entries(SUBTITLES)) {
    const { STORAGE_KEY, CONTAINER_ID, TOGGLE_ID, COLOR_PICKER_ID, FONT_SIZE_INPUT_ID, SAVE_BUTTON_ID } = metadata;
    const subtitle = await getStorage(STORAGE_KEY);
    if (subtitle) subtitleSettings[key] = new Proxy(subtitle, createSubtitleProxyHandler(key));

    const { enabled, color, fontSize } = subtitleSettings[key];

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

    document.getElementById(SAVE_BUTTON_ID)?.addEventListener('click', async () => {
      await setStorage(STORAGE_KEY, subtitleSettings[key]);
      setElementVisibility(SAVE_BUTTON_ID, false);
      setElementVisibility(TOGGLE_ID, true);
    });

    setElementVisibility(CONTAINER_ID, enabled);
  }
}

function createSubtitleProxyHandler(key: keyof typeof SUBTITLES) {
  return {
    set(target: SubtitleConfig, prop: keyof SubtitleConfig, value: SubtitleConfig[keyof SubtitleConfig]) {
      if (prop === 'enabled') {
        setStorage(SUBTITLES[key].STORAGE_KEY, { ...target, enabled: value as boolean });
      } else {
        setElementVisibility(SUBTITLES[key].TOGGLE_ID, false);
        setElementVisibility(SUBTITLES[key].SAVE_BUTTON_ID, true);
      }
      return Reflect.set(target, prop, value);
    },

    get(target: SubtitleConfig, prop: keyof SubtitleConfig) {
      if (target[prop]) return Reflect.get(target, prop);
      return DEFAULT_SUBTITLE_CONFIG[prop];
    },
  };
}
