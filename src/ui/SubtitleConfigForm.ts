import { html } from 'lit-html';
import Component from '../core/Component';
import { getMessage } from '../utils/i18n';
import { SETTINGS } from '../utils/constants';
import { setStorage, SubtitleConfig } from '../utils/storage';
import { resetInputValue, updateDefaultValue } from '../utils/dom';
import { getStorage } from '../utils/storage';
import { DEFAULT_CONFIG } from '../utils/default';
import { setElementVisibility } from '../utils/dom';
import { Toggle } from '../components/toggle';
import { NumberInput } from '../components/numberInput';
import { Switch } from '../components/switch';
import { Checkbox } from '../components/checkbox';
import { ColorPicker } from '../components/colorPicker';

const { PRIMARY, SECONDARY } = SETTINGS.SUBTITLES;

type SubtitleConfigFormProps = typeof PRIMARY | typeof SECONDARY;

export default class SubtitleConfigForm extends Component<SubtitleConfigFormProps> {
  afterRender() {
    this.initializeSubtitleSetting();
  }

  template() {
    const { TITLE_MESSAGE_KEY, INPUTS, BUTTONS, TOGGLE_ID, CONTAINER_ID } = this.props;
    return html`
      <header class="section-header">
        <h2 class="section-title">${getMessage(TITLE_MESSAGE_KEY)}</h2>
        <div class="row">
          <button id="${BUTTONS.CANCEL}" class="button bg-gray-500 hidden">${getMessage('cancel_button')}</button>
          <button id="${BUTTONS.SAVE}" class="button bg-teal-500 hidden">${getMessage('save_button')}</button>
          <div id="${TOGGLE_ID}"></div>
        </div>
      </header>
      <div id="${CONTAINER_ID}" class="section">
        <div class="row">
          <label for="${INPUTS.language}" class="label">${getMessage('language_label')}</label>
          <div id="${INPUTS.language}"></div>
        </div>
        <div class="row">
          <label for="${INPUTS.positionReference}" class="label">${getMessage('position_reference_label')}</label>
          <div id="${INPUTS.positionReference}"></div>
        </div>
        <div class="row">
          <label for="${INPUTS.positionOffset}" class="label">${getMessage('position_offset_label')}</label>
          <input id="${INPUTS.positionOffset}" class="input" type="number" />
        </div>
        <div class="row">
          <label for="${INPUTS.color}" class="label">${getMessage('subtitle_color_label')}</label>
          <div id="${INPUTS.color}"></div>
        </div>
        <div class="row">
          <label for="${INPUTS.fontSize}" class="label">${getMessage('subtitle_font_size_label')}</label>
          <input id="${INPUTS.fontSize}" class="input" type="number" min="1" max="10" />
        </div>
        <div class="row">
          <label for="${INPUTS.fontWeight}" class="label">${getMessage('subtitle_font_weight_label')}</label>
          <input id="${INPUTS.fontWeight}" class="input" type="number" min="1" max="6" />
        </div>
        <div class="row">
          <label for="${INPUTS.opacity}" class="label">${getMessage('subtitle_opacity_label')}</label>
          <input id="${INPUTS.opacity}" class="input" type="number" min="0" max="100" />
        </div>
        <div class="row">
          <label for="${INPUTS.lineBreak}" class="label">${getMessage('line_break_label')}</label>
          <input id="${INPUTS.lineBreak}" type="checkbox" />
        </div>
      </div>
    `;
  }

  private async initializeSubtitleSetting() {
    const { STORAGE_KEY, CONTAINER_ID, TOGGLE_ID, INPUTS, BUTTONS } = this.props;
    const data = (await getStorage(STORAGE_KEY)) || DEFAULT_CONFIG[STORAGE_KEY];
    const settings = new Proxy(data, this.proxyHandler());
    const inputInstances: Record<string, HTMLInputElement> = {};

    setElementVisibility(CONTAINER_ID, settings.enabled);

    Toggle({ id: TOGGLE_ID, isOn: settings.enabled, onChange: (enabled) => (settings.enabled = enabled) });

    Object.entries(INPUTS).forEach(([storageKey, inputId]) => {
      inputInstances[storageKey] = this.createInput(inputId, storageKey, settings);
    });

    document.getElementById(BUTTONS.CANCEL)?.addEventListener('click', () => {
      Object.values(INPUTS).forEach((id) => resetInputValue(id));
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
    const { STORAGE_KEY, CONTAINER_ID, TOGGLE_ID, BUTTONS } = this.props;
    return {
      set(target: SubtitleConfig, prop: keyof SubtitleConfig, value: SubtitleConfig[keyof SubtitleConfig]) {
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

      get(target: SubtitleConfig, prop: keyof SubtitleConfig) {
        if (target[prop] !== undefined) return Reflect.get(target, prop);
        return DEFAULT_CONFIG[STORAGE_KEY][prop];
      },
    };
  }

  private createInput(inputId: string, storageKey: keyof Omit<SubtitleConfig, 'enabled'>, settings: SubtitleConfig) {
    switch (storageKey) {
      case 'color':
        return ColorPicker({
          id: inputId,
          color: settings[storageKey],
          onChange: (newColor) => {
            settings[storageKey] = newColor;
          },
        });
      case 'lineBreak':
        return Checkbox({
          id: inputId,
          checked: settings[storageKey],
          onChange: (checked) => {
            settings[storageKey] = checked;
          },
        });
      case 'language':
        return Switch({
          id: inputId,
          options: [
            { label: getMessage('english'), value: 'en' },
            { label: getMessage('korean'), value: 'ko' },
          ],
          initialValue: settings[storageKey],
          onChange: (value) => {
            settings[storageKey] = value;
          },
        });
      case 'positionReference':
        return Switch({
          id: inputId,
          options: [
            { label: getMessage('top'), value: 'top' },
            { label: getMessage('center'), value: 'center' },
            { label: getMessage('bottom'), value: 'bottom' },
          ],
          initialValue: settings[storageKey],
          onChange: (value) => {
            settings[storageKey] = value;
          },
        });
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

  private updateButtonsVisibility(visible: boolean) {
    const { BUTTONS, TOGGLE_ID } = this.props;
    setElementVisibility(BUTTONS.CANCEL, visible);
    setElementVisibility(BUTTONS.SAVE, visible);
    setElementVisibility(TOGGLE_ID, !visible);
  }
}
