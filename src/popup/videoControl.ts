import { getStorage, removeStorage, setStorage, SubKeyConfig } from '../utils/storage';
import { FEEDBACK_DISPLAY_DURATION, SKIP_TIME, SUB_KEY } from '../utils/constants';
import { DEFAULT_SKIP_TIME, DEFAULT_SUB_KEY_CONFIG } from '../utils/default';
import { setupInput } from '../utils/dom';

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

export async function initializeSkipTimeSetting() {
  const { STORAGE_KEY, INPUT_ID, SAVE_BUTTON_ID } = SKIP_TIME;
  const skipTime = await getStorage(STORAGE_KEY);
  if (skipTime) keySettings.skipTime = skipTime;

  const timeInput = setupInput(INPUT_ID, keySettings.skipTime.toString());

  document.getElementById(SAVE_BUTTON_ID)?.addEventListener('click', () => handleSaveSkipTime(timeInput));
}

export async function initializeSubKeySetting() {
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
