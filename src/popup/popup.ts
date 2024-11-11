import { getStorage, onStorageChange, removeStorage, setStorage, SubKeyConfig, SubtitleConfig } from '../utils/storage';
import '../style.css';
import { Toggle } from '../components/toggle';
import { FEEDBACK_DISPLAY_DURATION, SKIP_TIME, SUB_KEY, SUBTITLES } from '../utils/constants';
import { ColorPicker } from '../components/colorPicker';
import { DEFAULT_SKIP_TIME, DEFAULT_SUB_KEY_CONFIG, DEFAULT_SUBTITLE_CONFIG } from '../utils/default';

async function initializeSettings() {
  initializeStorage();
  await loadTemplates();
  await initializeSubtitleSetting();
  await initializeSkipTimeSetting();
  await initializeSubKeySetting();
}

const subtitleSettings = Object.keys(SUBTITLES).reduce((acc, key) => {
  acc[key] = new Proxy(DEFAULT_SUBTITLE_CONFIG, createSubtitleProxyHandler(key));
  return acc;
}, {} as Record<keyof typeof SUBTITLES, SubtitleConfig>);

const subKeyProxyHandler = {
  set(target: SubKeyConfig, prop: keyof SubKeyConfig, value: SubKeyConfig[keyof SubKeyConfig]) {
    return Reflect.set(target, prop, value);
  },

  get(target: SubKeyConfig, prop: keyof SubKeyConfig) {
    if (target[prop]) return Reflect.get(target, prop);
    return DEFAULT_SUB_KEY_CONFIG[prop];
  },
};

const keySettings = {
  skipTime: DEFAULT_SKIP_TIME,
  subKey: new Proxy(DEFAULT_SUB_KEY_CONFIG, subKeyProxyHandler),
};

function initializeStorage() {
  onStorageChange((changes) => {
    for (const { STORAGE_KEY, CONTAINER_ID } of Object.values(SUBTITLES)) {
      const subtitleChanges = changes[STORAGE_KEY];

      if (subtitleChanges && subtitleChanges.newValue) {
        setElementVisibility(CONTAINER_ID, subtitleChanges.newValue.enabled);
      }
    }
  });
}

async function loadTemplates() {
  const response = await fetch('template.html');
  const text = await response.text();
  document.body.insertAdjacentHTML('beforeend', text);
}

async function initializeSubtitleSetting() {
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

async function initializeSkipTimeSetting() {
  const { STORAGE_KEY, INPUT_ID, SAVE_BUTTON_ID } = SKIP_TIME;
  const skipTime = await getStorage(STORAGE_KEY);
  if (skipTime) keySettings.skipTime = skipTime;

  const timeInput = setupInput(INPUT_ID, keySettings.skipTime.toString());

  document.getElementById(SAVE_BUTTON_ID)?.addEventListener('click', () => handleSaveSkipTime(timeInput));
}

async function initializeSubKeySetting() {
  const { STORAGE_KEY, BACKWARD_INPUT_ID, FORWARD_INPUT_ID, SKIP_TIME_INPUT_ID, SAVE_BUTTON_ID, RESET_BUTTON_ID } =
    SUB_KEY;
  const subKey = await getStorage(STORAGE_KEY);
  if (subKey) keySettings.subKey = new Proxy(subKey, subKeyProxyHandler);

  const { backward, forward, skipTime } = keySettings.subKey;

  const backwardInput = setupInput(BACKWARD_INPUT_ID, backward);
  const forwardInput = setupInput(FORWARD_INPUT_ID, forward);
  const timeInput = setupInput(SKIP_TIME_INPUT_ID, skipTime.toString());

  setupKeydownHandlers([forwardInput, backwardInput]);
  document
    .getElementById(SAVE_BUTTON_ID)
    ?.addEventListener('click', () => handleSaveSubKey(forwardInput, backwardInput, timeInput));
  document
    .getElementById(RESET_BUTTON_ID)
    ?.addEventListener('click', () => handleResetSubKey(forwardInput, backwardInput, timeInput));
}

function setElementVisibility(id: string, isVisible: boolean) {
  const element = document.getElementById(id);

  if (isVisible) element?.classList.remove('hidden');
  else element?.classList.add('hidden');
}

function setupInput(elementId: string, defaultValue: string): HTMLInputElement {
  const input = document.getElementById(elementId) as HTMLInputElement;
  input.value = defaultValue;
  return input;
}

function setupKeydownHandlers(inputs: HTMLInputElement[]) {
  inputs.forEach((input) =>
    input.addEventListener('keydown', (event) => {
      event.preventDefault();
      input.value = event.code;
      input.blur();
    })
  );
}

async function handleSaveSkipTime(timeInput: HTMLInputElement) {
  const seconds = parseInt(timeInput.value, 10);
  if (validateSkipTime(seconds)) {
    await setStorage('skipTime', seconds);
    showFeedback('feedback_1_s');
  } else {
    showFeedback('feedback_1_e');
  }
}

async function handleSaveSubKey(
  forwardInput: HTMLInputElement,
  backwardInput: HTMLInputElement,
  timeInput: HTMLInputElement
) {
  const seconds = parseInt(timeInput.value, 10);

  if (validateSkipTime(seconds) && forwardInput.value && backwardInput.value) {
    await setStorage('subKey', {
      forward: forwardInput.value,
      backward: backwardInput.value,
      skipTime: seconds,
    });
    showFeedback('feedback_2_s');
  } else {
    showFeedback('feedback_2_e');
  }
}

async function handleResetSubKey(
  forwardInput: HTMLInputElement,
  backwardInput: HTMLInputElement,
  timeInput: HTMLInputElement
) {
  await removeStorage('subKey');
  forwardInput.value = '';
  backwardInput.value = '';
  timeInput.value = DEFAULT_SKIP_TIME.toString();
}

function showFeedback(id: string) {
  const feedback = document.getElementById(id) as HTMLDivElement;
  feedback.classList.remove('hidden');
  setTimeout(() => feedback.classList.add('hidden'), FEEDBACK_DISPLAY_DURATION);
}

function validateSkipTime(seconds: number) {
  return !isNaN(seconds) && seconds > 0;
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

document.addEventListener('DOMContentLoaded', initializeSettings);
