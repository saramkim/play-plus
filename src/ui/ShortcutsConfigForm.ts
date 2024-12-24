import { html } from 'lit-html';
import Component from '../core/Component';
import { SETTINGS } from '../utils/constants';
import { getMessage } from '../utils/i18n';
import { Toggle } from '../components/toggle';
import { getStorage, setStorage, ShortcutsConfig } from '../utils/storage';
import { DEFAULT_CONFIG } from '../utils/default';
import { KeydownInput } from '../components/keydownInput';
import { resetInputValue, setElementVisibility, updateDefaultValue } from '../utils/dom';

const { STORAGE_KEY, BUTTONS, INPUTS, TOGGLE_ID, CONTAINER_ID } = SETTINGS.SHORTCUTS;

export default class ShortcutsConfigForm extends Component {
  onMount() {
    this.init();
  }

  template() {
    return html`
      <header class="section-header">
        <h2 class="section-title">${getMessage('shortcuts_section_title')}</h2>
        <div class="row">
          <button id="${BUTTONS.CANCEL}" class="button bg-gray-500 hidden">${getMessage('cancel_button')}</button>
          <button id="${BUTTONS.SAVE}" class="button bg-teal-500 hidden">${getMessage('save_button')}</button>
          <div id="${TOGGLE_ID}"></div>
        </div>
      </header>
      <div id="${CONTAINER_ID}" class="section">
        <div class="row">
          <label for="${INPUTS.savePrimary}" class="label">
            ${getMessage('primary_subtitle_save_shortcuts_label')}
          </label>
          <input id="${INPUTS.savePrimary}" class="input" readonly />
        </div>
        <div class="row">
          <label for="${INPUTS.saveSecondary}" class="label">
            ${getMessage('secondary_subtitle_save_shortcuts_label')}
          </label>
          <input id="${INPUTS.saveSecondary}" class="input" readonly />
        </div>
        <div class="row">
          <label for="${INPUTS.togglePrimary}" class="label">
            ${getMessage('primary_subtitle_toggle_shortcuts_label')}
          </label>
          <input id="${INPUTS.togglePrimary}" class="input" readonly />
        </div>
        <div class="row">
          <label for="${INPUTS.toggleSecondary}" class="label">
            ${getMessage('secondary_subtitle_toggle_shortcuts_label')}
          </label>
          <input id="${INPUTS.toggleSecondary}" class="input" readonly />
        </div>
      </div>
    `;
  }

  private async init() {
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
      set(target: ShortcutsConfig, prop: keyof ShortcutsConfig, value: ShortcutsConfig[keyof ShortcutsConfig]) {
        if (prop === 'enabled') {
          setStorage(STORAGE_KEY, { ...target, enabled: value as boolean });
          setElementVisibility(CONTAINER_ID, value as boolean);
        } else {
          setElementVisibility(BUTTONS.CANCEL, true);
          setElementVisibility(BUTTONS.SAVE, true);
          setElementVisibility(TOGGLE_ID, false);
        }
        return Reflect.set(target, prop, value);
      },

      get(target: ShortcutsConfig, prop: keyof ShortcutsConfig) {
        if (target[prop] !== undefined) return Reflect.get(target, prop);
        return DEFAULT_CONFIG[STORAGE_KEY][prop];
      },
    };
  }

  private createInput(inputId: string, storageKey: keyof Omit<ShortcutsConfig, 'enabled'>, settings: ShortcutsConfig) {
    return KeydownInput({
      id: inputId,
      value: settings[storageKey],
      onChange: (newValue) => {
        settings[storageKey] = newValue;
      },
    });
  }

  private resetInputsValue() {
    Object.values(INPUTS).forEach((id) => resetInputValue(id, { eventType: 'keydown' }));
  }

  private updateButtonsVisibility(visible: boolean) {
    setElementVisibility(BUTTONS.CANCEL, visible);
    setElementVisibility(BUTTONS.SAVE, visible);
    setElementVisibility(TOGGLE_ID, !visible);
  }
}
