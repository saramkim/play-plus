import { getStorage, onStorageChange, removeStorage, setStorage, SubtitleConfig } from '../utils/storage';
import '../style.css';
import { Toggle } from '../components/toggle';
import { DEFAULT_SKIP_TIME, DEFAULT_SUBTITLE_CONFIG, FEEDBACK_DISPLAY_DURATION, SUBTITLES } from '../utils/constants';
import { ColorPicker } from '../components/colorPicker';

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

    const isEnabled = subtitle?.enabled || false;

    const toggle = Toggle({
      isOn: isEnabled,
      onChange: async (enabled) => {
        subtitleSettings[key].enabled = enabled;
      },
    });
    document.getElementById(TOGGLE_ID)?.appendChild(toggle);

    const colorPicker = ColorPicker({
      id: `${COLOR_PICKER_ID}_input`,
      color: subtitle?.color,
      onChange: (color) => {
        subtitleSettings[key].color = color;
      },
    });
    document.getElementById(COLOR_PICKER_ID)?.appendChild(colorPicker);

    const fontSizeInput = setupInput(FONT_SIZE_INPUT_ID, subtitleSettings[key].fontSize.toString());
    fontSizeInput.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement;
      subtitleSettings[key].fontSize = parseInt(target.value, 10);
    });

    document.getElementById(SAVE_BUTTON_ID)?.addEventListener('click', async () => {
      await setStorage(STORAGE_KEY, subtitleSettings[key]);
      setElementVisibility(SAVE_BUTTON_ID, false);
      setElementVisibility(TOGGLE_ID, true);
    });

    setElementVisibility(CONTAINER_ID, isEnabled);
  }
}

async function initializeSkipTimeSetting() {
  const skipTime = await getStorage('skipTime');
  const timeInput = setupInput('skip-time', DEFAULT_SKIP_TIME.toString(), skipTime?.toString());

  document.getElementById('save-skip-time')?.addEventListener('click', () => handleSaveSkipTime(timeInput));
}

async function initializeSubKeySetting() {
  const subKey = await getStorage('subKey');
  const forwardInput = setupInput('sub-forward-key', '', subKey?.forward);
  const backwardInput = setupInput('sub-backward-key', '', subKey?.backward);
  const timeInput = setupInput('sub-skip-time', DEFAULT_SKIP_TIME.toString(), subKey?.skipTime?.toString());

  setupKeydownHandlers([forwardInput, backwardInput]);
  document
    .getElementById('save-sub-key')
    ?.addEventListener('click', () => handleSaveSubKey(forwardInput, backwardInput, timeInput));
  document
    .getElementById('reset-sub-key')
    ?.addEventListener('click', () => handleResetSubKey(forwardInput, backwardInput, timeInput));
}

function setElementVisibility(id: string, isVisible: boolean) {
  const element = document.getElementById(id);

  if (isVisible) element?.classList.remove('hidden');
  else element?.classList.add('hidden');
}

function setupInput(elementId: string, defaultValue: string, storageValue?: string): HTMLInputElement {
  const input = document.getElementById(elementId) as HTMLInputElement;
  input.value = storageValue || defaultValue;
  return input;
}

function setupKeydownHandlers(inputs: HTMLInputElement[]) {
  inputs.forEach((input) =>
    input.addEventListener('keydown', (event) => {
      event.preventDefault();
      input.value = event.code;
      input.blur();
    }),
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
  timeInput: HTMLInputElement,
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
  timeInput: HTMLInputElement,
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
