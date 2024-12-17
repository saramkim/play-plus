import { html } from 'lit-html';
import Component from '../core/Component';
import { getMessage } from '../utils/i18n';
import { DEFAULT_CONFIG } from '../utils/default';
import { setStorage, SubKeyConfig } from '../utils/storage';
import { getStorage } from '../utils/storage';
import { resetInputValue, setButtonAvailabilityWithTag, setElementVisibility, updateDefaultValue } from '../utils/dom';
import { SETTINGS } from '../utils/constants';
import { Toggle } from '../components/toggle';
import { KeydownInput } from '../components/keydownInput';
import { NumberInput } from '../components/numberInput';
import { validateAll } from '../utils/validation';

const { STORAGE_KEY, INPUTS, BUTTONS, TOGGLE_ID, CONTAINER_ID } = SETTINGS.SUB_KEY;

export default class SubKeyConfigForm extends Component {
  afterRender() {
    this.initializeSubKeySetting();
  }

  template() {
    return html`
      <header class="section-header">
        <h2 class="section-title">${getMessage('sub_key_section_title')}</h2>
        <div class="row">
          <button id="${BUTTONS.CANCEL}" class="button bg-gray-500 hidden">${getMessage('cancel_button')}</button>
          <button id="${BUTTONS.SAVE}" class="button bg-teal-500 hidden" disabled>${getMessage('save_button')}</button>
          <div id="${TOGGLE_ID}"></div>
        </div>
      </header>
      <div id="${CONTAINER_ID}" class="section">
        <div class="row">
          <label for="${INPUTS.backward}" class="label">${getMessage('backward_key_label')}</label>
          <input id="${INPUTS.backward}" class="input" readonly />
        </div>
        <div class="row">
          <label for="${INPUTS.forward}" class="label">${getMessage('forward_key_label')}</label>
          <input id="${INPUTS.forward}" class="input" readonly />
        </div>
        <div class="row">
          <label for="${INPUTS.skipTime}" class="label">${getMessage('video_skip_time_label')}</label>
          <input id="${INPUTS.skipTime}" class="input" type="number" />
        </div>
      </div>
    `;
  }

  private async initializeSubKeySetting() {
    const data = (await getStorage(STORAGE_KEY)) || DEFAULT_CONFIG[STORAGE_KEY];
    const settings = new Proxy(data, this.proxyHandler());
    const inputInstances: Record<string, HTMLInputElement> = {};

    setElementVisibility(CONTAINER_ID, settings.enabled);

    Toggle({ id: TOGGLE_ID, isOn: settings.enabled, onChange: (enabled) => (settings.enabled = enabled) });

    Object.entries(INPUTS).forEach(([storageKey, inputId]) => {
      inputInstances[storageKey] = this.createInput(inputId, storageKey, settings);
    });

    document.getElementById(BUTTONS.CANCEL)?.addEventListener('click', () => {
      this.resetInputsValue();
      this.updateButtonsVisibility(false);
    });

    document.getElementById(BUTTONS.SAVE)?.addEventListener('click', async () => {
      await setStorage(STORAGE_KEY, settings);
      this.updateButtonsVisibility(false);

      Object.keys(INPUTS).forEach((storageKey) => {
        updateDefaultValue(inputInstances[storageKey], settings[storageKey]);
      });
    });
  }

  private proxyHandler() {
    return {
      set(target: SubKeyConfig, prop: keyof SubKeyConfig, value: SubKeyConfig[keyof SubKeyConfig]) {
        if (prop === 'enabled') {
          setStorage(STORAGE_KEY, { ...target, enabled: value as boolean });
          setElementVisibility(CONTAINER_ID, value as boolean);
        } else {
          const result = validateAll(target, prop, value);
          setButtonAvailabilityWithTag(BUTTONS.SAVE, result);
          setElementVisibility(BUTTONS.CANCEL, true);
          setElementVisibility(BUTTONS.SAVE, true);
          setElementVisibility(TOGGLE_ID, false);
        }
        return Reflect.set(target, prop, value);
      },

      get(target: SubKeyConfig, prop: keyof SubKeyConfig) {
        if (target[prop]) return Reflect.get(target, prop);
        return DEFAULT_CONFIG[STORAGE_KEY][prop];
      },
    };
  }

  private createInput(inputId: string, storageKey: keyof Omit<SubKeyConfig, 'enabled'>, settings: SubKeyConfig) {
    switch (storageKey) {
      case 'skipTime':
        return NumberInput({
          id: inputId,
          value: settings[storageKey],
          onChange: (newValue) => {
            settings[storageKey] = newValue;
          },
        });
      default:
        return KeydownInput({
          id: inputId,
          value: settings[storageKey],
          onChange: (newValue) => {
            settings[storageKey] = newValue;
          },
        });
    }
  }

  private resetInputsValue() {
    resetInputValue(INPUTS.backward, { eventType: 'keydown' });
    resetInputValue(INPUTS.forward, { eventType: 'keydown' });
    resetInputValue(INPUTS.skipTime);
  }

  private updateButtonsVisibility(visible: boolean) {
    setElementVisibility(BUTTONS.CANCEL, visible);
    setElementVisibility(BUTTONS.SAVE, visible);
    setElementVisibility(TOGGLE_ID, !visible);
  }
}
