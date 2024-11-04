import { getStorage, removeStorage, setStorage } from '../utils/storage';
import '../style.css';
import { Toggle } from '../components/toggle';

const FEEDBACK_DISPLAY_DURATION = 800;
const IS_SUBTITLE_ON_STORAGE_KEY = 'isSubtitleOn';
const SKIP_TIME_STORAGE_KEY = 'skipTime';
const SUB_KEY_STORAGE_KEY = 'subKey';

async function initializeSettings() {
  await loadTemplates();
  await initializeSubtitleSetting();
  await initializeSkipTimeSetting();
  await initializeSubKeySetting();
}

async function loadTemplates() {
  const response = await fetch('template.html');
  const text = await response.text();
  document.body.insertAdjacentHTML('beforeend', text);
}

async function initializeSubtitleSetting() {
  const isSubtitleOn = (await getStorage(IS_SUBTITLE_ON_STORAGE_KEY)) || false;

  const toggle = Toggle({
    isOn: isSubtitleOn,
    onChange: (isOn) => setStorage(IS_SUBTITLE_ON_STORAGE_KEY, isOn),
  });

  document.getElementById('toggle-container')?.appendChild(toggle);
}

async function initializeSkipTimeSetting() {
  const skipTime = await getStorage(SKIP_TIME_STORAGE_KEY);
  const timeInput = setupInput('skip-time', '10', skipTime?.toString());

  document.getElementById('save-skip-time')?.addEventListener('click', () => handleSaveSkipTime(timeInput));
}

async function initializeSubKeySetting() {
  const subKey = await getStorage(SUB_KEY_STORAGE_KEY);
  const forwardInput = setupInput('sub-forward-key', '', subKey?.forward);
  const backwardInput = setupInput('sub-backward-key', '', subKey?.backward);
  const timeInput = setupInput('sub-skip-time', '10', subKey?.skipTime?.toString());

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
    await setStorage(SKIP_TIME_STORAGE_KEY, seconds);
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

  if (validateSkipTime(seconds) && (forwardInput.value || backwardInput.value)) {
    await setStorage(SUB_KEY_STORAGE_KEY, {
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
  await removeStorage(SUB_KEY_STORAGE_KEY);
  forwardInput.value = '';
  backwardInput.value = '';
  timeInput.value = '10';
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
