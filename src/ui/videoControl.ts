import { getStorage, setStorage, StorageChanges, SubKeyConfig } from '../utils/storage';
import { SKIP_TIME, SUB_KEY } from '../utils/constants';
import { DEFAULT_SKIP_TIME, DEFAULT_SUB_KEY_CONFIG } from '../utils/default';
import { setButtonAvailabilityWithTag, setElementVisibility, setupInput } from '../utils/dom';
import { Toggle } from '../components/toggle';
import { validate, validateAll } from '../utils/validation';

const subKeyProxyHandler = {
  set(target: SubKeyConfig, prop: keyof SubKeyConfig, value: SubKeyConfig[keyof SubKeyConfig]) {
    const { STORAGE_KEY, TOGGLE_ID, SAVE_BUTTON_ID } = SUB_KEY;
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

  get(target: SubKeyConfig, prop: keyof SubKeyConfig) {
    if (target[prop]) return Reflect.get(target, prop);
    return DEFAULT_SUB_KEY_CONFIG[prop];
  },
};

const keySettings = {
  skipTime: DEFAULT_SKIP_TIME,
  subKey: new Proxy(DEFAULT_SUB_KEY_CONFIG, subKeyProxyHandler),
};

export function onSubKeyStorageChange(changes: StorageChanges) {
  const { STORAGE_KEY, CONTAINER_ID } = SUB_KEY;
  const subKeyChanges = changes[STORAGE_KEY];

  if (subKeyChanges && subKeyChanges.newValue) {
    setElementVisibility(CONTAINER_ID, subKeyChanges.newValue.enabled);
  }
}

export async function initializeSkipTimeSetting() {
  const { STORAGE_KEY, INPUT_ID, SAVE_BUTTON_ID } = SKIP_TIME;
  const skipTime = await getStorage(STORAGE_KEY);
  if (skipTime) keySettings.skipTime = skipTime;

  const timeInput = setupInput(INPUT_ID, keySettings.skipTime.toString());
  timeInput.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement;
    keySettings.skipTime = parseInt(target.value, 10);

    const result = validate(STORAGE_KEY, keySettings.skipTime);
    setButtonAvailabilityWithTag(SAVE_BUTTON_ID, result);
  });

  document.getElementById(SAVE_BUTTON_ID)?.addEventListener('click', () => {
    setStorage(STORAGE_KEY, keySettings.skipTime);
  });
}

export async function initializeSubKeySetting() {
  const {
    STORAGE_KEY,
    CONTAINER_ID,
    TOGGLE_ID,
    BACKWARD_INPUT_ID,
    FORWARD_INPUT_ID,
    SKIP_TIME_INPUT_ID,
    SAVE_BUTTON_ID,
  } = SUB_KEY;
  const subKeyStorage = await getStorage(STORAGE_KEY);
  if (subKeyStorage) keySettings.subKey = new Proxy(subKeyStorage, subKeyProxyHandler);

  const { subKey } = keySettings;
  const { enabled, backward, forward, skipTime } = subKey;

  setElementVisibility(CONTAINER_ID, enabled);

  Toggle({
    id: TOGGLE_ID,
    isOn: enabled,
    onChange: async (enabled) => {
      subKey.enabled = enabled;
    },
  });

  const backwardInput = setupInput(BACKWARD_INPUT_ID, backward);
  backwardInput.addEventListener('keydown', (event) => {
    event.preventDefault();
    subKey.backward = event.code;
    backwardInput.value = event.code;
    backwardInput.blur();
  });

  const forwardInput = setupInput(FORWARD_INPUT_ID, forward);
  forwardInput.addEventListener('keydown', (event) => {
    event.preventDefault();
    subKey.forward = event.code;
    forwardInput.value = event.code;
    forwardInput.blur();
  });

  const timeInput = setupInput(SKIP_TIME_INPUT_ID, skipTime.toString());
  timeInput.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement;
    subKey.skipTime = parseInt(target.value, 10);
  });

  document.getElementById(SAVE_BUTTON_ID)?.addEventListener('click', async () => {
    await setStorage(STORAGE_KEY, subKey);
    setElementVisibility(SAVE_BUTTON_ID, false);
    setElementVisibility(TOGGLE_ID, true);
  });
}
