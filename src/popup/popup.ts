import { getStorage, removeStorage, setStorage } from '../utils/storage';
import '../style.css';

const FEEDBACK_DISPLAY_DURATION = 800;
const SKIP_TIME_STORAGE_KEY = 'skipTime';
const SUB_KEY_STORAGE_KEY = 'subKey';

async function initializeSkipTimeSetting() {
  const skipTime = await getStorage(SKIP_TIME_STORAGE_KEY);
  const timeInput = initializeInput('skip-time', '10', skipTime?.toString());

  document.getElementById('save-skip-time')?.addEventListener('click', async () => {
    const seconds = parseInt(timeInput.value, 10);

    if (validateSkipTime(seconds)) {
      await setStorage(SKIP_TIME_STORAGE_KEY, seconds);
      showFeedback('feedback_1_s');
    } else {
      showFeedback('feedback_1_e');
    }
  });
}

async function initializeSubKeySetting() {
  const subKey = await getStorage(SUB_KEY_STORAGE_KEY);
  const forwardInput = initializeInput('sub-forward-key', '', subKey?.forward);
  const backwardInput = initializeInput('sub-backward-key', '', subKey?.backward);
  const timeInput = initializeInput('sub-skip-time', '10', subKey?.skipTime?.toString());

  addKeydownHandler(forwardInput);
  addKeydownHandler(backwardInput);

  document.getElementById('save-sub-key')?.addEventListener('click', async () => {
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
  });

  document.getElementById('reset-sub-key')?.addEventListener('click', async () => {
    await removeStorage('subKey');
    forwardInput.value = '';
    backwardInput.value = '';
    timeInput.value = '10';
  });
}

function initializeInput(elementId: string, defaultValue: string, storageValue?: string) {
  const input = document.getElementById(elementId) as HTMLInputElement;
  input.value = storageValue || defaultValue;
  return input;
}

function addKeydownHandler(inputElement: HTMLInputElement) {
  inputElement.addEventListener('keydown', (event) => {
    event.preventDefault();
    inputElement.value = event.code;
    inputElement.blur();
  });
}

function showFeedback(id: string) {
  const feedback = document.getElementById(id) as HTMLDivElement;
  feedback.classList.remove('hidden');
  setTimeout(() => feedback.classList.add('hidden'), FEEDBACK_DISPLAY_DURATION);
}

function validateSkipTime(seconds: number) {
  return !isNaN(seconds) && seconds > 0;
}

document.addEventListener('DOMContentLoaded', async () => {
  await initializeSkipTimeSetting();
  await initializeSubKeySetting();
});
