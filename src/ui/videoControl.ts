import { getStorage, setStorage, StorageChanges, SubKeyConfig } from '../utils/storage';
import { SETTINGS } from '../utils/constants';
import { DEFAULT_SKIP_TIME, DEFAULT_SUB_KEY_CONFIG } from '../utils/default';
import {
  resetInputValue,
  setButtonAvailabilityWithTag,
  setElementAvailability,
  setElementVisibility,
  setupInput,
  updateDefaultValue,
} from '../utils/dom';
import { Toggle } from '../components/toggle';
import { validate, validateAll } from '../utils/validation';
import { NumberInput } from '../components/numberInput';
import { KeydownInput } from '../components/keydownInput';

const { SUB_KEY, SKIP_TIME } = SETTINGS;

const subKeyProxyHandler = {
  set(target: SubKeyConfig, prop: keyof SubKeyConfig, value: SubKeyConfig[keyof SubKeyConfig]) {
    const { STORAGE_KEY, BUTTONS } = SUB_KEY;
    if (prop === 'enabled') {
      setStorage(STORAGE_KEY, { ...target, enabled: value as boolean });
    } else {
      const result = validateAll(target, prop, value);
      setButtonAvailabilityWithTag(BUTTONS.SAVE, result);
      updateButtonsVisibility(true);
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
  const { STORAGE_KEY, INPUTS, BUTTONS } = SKIP_TIME;
  const skipTime = await getStorage(STORAGE_KEY);
  if (skipTime) keySettings.skipTime = skipTime;

  const timeInput = setupInput(INPUTS.skipTime, keySettings.skipTime.toString());
  timeInput.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement;
    keySettings.skipTime = parseInt(target.value, 10);

    const result = validate(STORAGE_KEY, keySettings.skipTime);
    setElementAvailability(BUTTONS.CANCEL, true);
    setButtonAvailabilityWithTag(BUTTONS.SAVE, result);
  });

  document.getElementById(BUTTONS.CANCEL)?.addEventListener('click', () => {
    resetInputValue(INPUTS.skipTime);
    setElementAvailability(BUTTONS.CANCEL, false);
    setElementAvailability(BUTTONS.SAVE, false);
  });

  document.getElementById(BUTTONS.SAVE)?.addEventListener('click', async () => {
    await setStorage(STORAGE_KEY, keySettings.skipTime);
    setElementAvailability(BUTTONS.CANCEL, false);
    setElementAvailability(BUTTONS.SAVE, false);
    updateDefaultValue(timeInput, keySettings.skipTime);
  });
}

export async function initializeSubKeySetting() {
  const { STORAGE_KEY, CONTAINER_ID, TOGGLE_ID, INPUTS, BUTTONS } = SUB_KEY;
  const subKeyStorage = await getStorage(STORAGE_KEY);
  if (subKeyStorage) keySettings.subKey = new Proxy(subKeyStorage, subKeyProxyHandler);

  const { subKey } = keySettings;
  const { enabled, ...settings } = subKey;

  setElementVisibility(CONTAINER_ID, enabled);

  Toggle({ id: TOGGLE_ID, isOn: enabled, onChange: (enabled) => (subKey.enabled = enabled) });

  const inputInstances: Record<string, HTMLInputElement> = {};

  Object.entries(INPUTS).forEach(([storageKey, inputId]) => {
    inputInstances[storageKey] = createInput(inputId, storageKey, settings);
  });

  document.getElementById(BUTTONS.CANCEL)?.addEventListener('click', () => {
    resetInputsValue();
    updateButtonsVisibility(false);
  });

  document.getElementById(BUTTONS.SAVE)?.addEventListener('click', async () => {
    await setStorage(STORAGE_KEY, subKey);
    updateButtonsVisibility(false);

    Object.keys(INPUTS).forEach((storageKey) => {
      updateDefaultValue(inputInstances[storageKey], subKey[storageKey]);
    });
  });
}

function createInput(
  inputId: string,
  storageKey: keyof Omit<SubKeyConfig, 'enabled'>,
  settings: Omit<SubKeyConfig, 'enabled'>
) {
  switch (storageKey) {
    case 'skipTime':
      return NumberInput({
        id: inputId,
        value: settings[storageKey],
        onChange: (newValue) => {
          keySettings.subKey[storageKey] = newValue;
        },
      });
    default:
      return KeydownInput({
        id: inputId,
        value: settings[storageKey],
        onChange: (newValue) => {
          keySettings.subKey[storageKey] = newValue;
        },
      });
  }
}

function resetInputsValue() {
  const { INPUTS } = SUB_KEY;
  resetInputValue(INPUTS.backward, { eventType: 'keydown' });
  resetInputValue(INPUTS.forward, { eventType: 'keydown' });
  resetInputValue(INPUTS.skipTime);
}

function updateButtonsVisibility(visible: boolean) {
  const { TOGGLE_ID, BUTTONS } = SUB_KEY;
  setElementVisibility(BUTTONS.CANCEL, visible);
  setElementVisibility(BUTTONS.SAVE, visible);
  setElementVisibility(TOGGLE_ID, !visible);
}
