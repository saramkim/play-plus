import { NumberInput } from '../components/numberInput';
import { SETTINGS } from '../utils/constants';
import { DEFAULT_CONFIG } from '../utils/default';
import {
  resetInputValue,
  setButtonAvailabilityWithTag,
  setElementAvailability,
  updateDefaultValue,
} from '../utils/dom';
import { getStorage, setStorage, VideoConfig } from '../utils/storage';
import { validateAll } from '../utils/validation';

const { VIDEO } = SETTINGS;

const proxyHandler = {
  set(target: VideoConfig, prop: keyof VideoConfig, value: VideoConfig[keyof VideoConfig]) {
    const { BUTTONS } = VIDEO;

    const result = validateAll(target, prop, value);
    setButtonAvailabilityWithTag(BUTTONS.SAVE, result);
    setElementAvailability(BUTTONS.CANCEL, true);

    return Reflect.set(target, prop, value);
  },

  get(target: VideoConfig, prop: keyof VideoConfig) {
    const { STORAGE_KEY } = VIDEO;
    if (target[prop]) return Reflect.get(target, prop);
    return DEFAULT_CONFIG[STORAGE_KEY][prop];
  },
};

export async function initializeVideoSetting() {
  const { STORAGE_KEY, INPUTS, BUTTONS } = VIDEO;
  const data = (await getStorage(STORAGE_KEY)) || DEFAULT_CONFIG[STORAGE_KEY];
  const settings = new Proxy(data, proxyHandler);
  const inputInstances: Record<string, HTMLInputElement> = {};

  Object.entries(INPUTS).forEach(([storageKey, inputId]) => {
    inputInstances[storageKey] = createInput(inputId, storageKey, settings);
  });

  document.getElementById(BUTTONS.CANCEL)?.addEventListener('click', () => {
    Object.values(INPUTS).forEach((id) => resetInputValue(id));
    Object.values(BUTTONS).forEach((id) => setElementAvailability(id, false));
  });

  document.getElementById(BUTTONS.SAVE)?.addEventListener('click', async () => {
    await setStorage(STORAGE_KEY, settings);
    Object.keys(INPUTS).forEach((storageKey) => updateDefaultValue(inputInstances[storageKey], settings[storageKey]));
    Object.values(BUTTONS).forEach((id) => setElementAvailability(id, false));
  });
}

function createInput(inputId: string, storageKey: keyof VideoConfig, settings: VideoConfig) {
  switch (storageKey) {
    default:
      return NumberInput({
        id: inputId,
        value: settings[storageKey],
        onChange: (newValue) => {
          settings[storageKey] = newValue;
        },
      });
  }
}
