import { getStorage, removeStorage, setStorage } from '../utils/storage';
import '../style.css';
import { Toggle } from '../components/toggle';
import { DEFAULT_SKIP_TIME, FEEDBACK_DISPLAY_DURATION } from '../utils/constants';

async function initializeSettings() {
  await loadTemplates();
  await initializeEnglishSubtitleSetting();
  await initializeKoreanSubtitleSetting();
  await initializeSkipTimeSetting();
  await initializeSubKeySetting();
}

async function loadTemplates() {
  const response = await fetch('template.html');
  const text = await response.text();
  document.body.insertAdjacentHTML('beforeend', text);
}

async function initializeEnglishSubtitleSetting() {
  const englishSubtitle = await getStorage('englishSubtitle');
  const toggle = Toggle({
    isOn: englishSubtitle?.enabled || false,
    onChange: (enabled) => setStorage('englishSubtitle', { enabled }),
  });
  document.getElementById('english-toggle-container')?.appendChild(toggle);
}

async function initializeKoreanSubtitleSetting() {
  const koreanSubtitle = await getStorage('koreanSubtitle');
  const toggle = Toggle({
    isOn: koreanSubtitle?.enabled || false,
    onChange: (enabled) => setStorage('koreanSubtitle', { enabled }),
  });

  document.getElementById('korean-toggle-container')?.appendChild(toggle);
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

document.addEventListener('DOMContentLoaded', initializeSettings);
