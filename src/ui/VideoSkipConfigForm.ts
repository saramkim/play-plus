import { html } from 'lit-html';
import Component from '../core/Component';
import { getMessage } from '../utils/i18n';
import { DEFAULT_CONFIG } from '../utils/default';
import { setStorage, VideoSkipConfig } from '../utils/storage';
import { getStorage } from '../utils/storage';
import { resetInputValue, setElementVisibility, updateDefaultValue } from '../utils/dom';
import { POPUP_CONTAINER_ID, SETTINGS } from '../utils/constants';
import { Toggle } from '../components/toggle';
import { KeydownInput } from '../components/keydownInput';
import { NumberInput } from '../components/numberInput';
import Dropdown from '../components/Dropdown';
import Popup from '../components/Popup';

const { VIDEO_SKIP, SUB_VIDEO_SKIP } = SETTINGS;

type VideoSkipConfigFormProps = typeof VIDEO_SKIP | typeof SUB_VIDEO_SKIP;

export default class VideoSkipConfigForm extends Component<VideoSkipConfigFormProps> {
  afterRender() {
    this.initializeSetting();
  }

  template() {
    const { INPUTS, BUTTONS, TOGGLE_ID, CONTAINER_ID, SKIP_TIME_UNIT, TITLE_MESSAGE_KEY } = this.props;
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
          <label for="${INPUTS.backward}" class="label">${getMessage('backward_key_label')}</label>
          <input id="${INPUTS.backward}" class="input" readonly />
        </div>
        <div class="row">
          <label for="${INPUTS.forward}" class="label">${getMessage('forward_key_label')}</label>
          <input id="${INPUTS.forward}" class="input" readonly />
        </div>
        <div class="row">
          <label for="${INPUTS.skipTime}" class="label">${getMessage('video_skip_time_label')}</label>
          <input id="${INPUTS.skipTime}" class="input" type="number" min="1" />
          <div id="${SKIP_TIME_UNIT}"></div>
        </div>
      </div>
    `;
  }

  private async initializeSetting() {
    const { STORAGE_KEY, INPUTS, BUTTONS, TOGGLE_ID, CONTAINER_ID, SKIP_TIME_UNIT } = this.props;
    const data = (await getStorage(STORAGE_KEY)) || DEFAULT_CONFIG[STORAGE_KEY];
    const settings = new Proxy(data, this.proxyHandler());
    const inputInstances: Record<string, HTMLInputElement> = {};

    setElementVisibility(CONTAINER_ID, settings.enabled);

    Toggle({ id: TOGGLE_ID, isOn: settings.enabled, onChange: (enabled) => (settings.enabled = enabled) });

    const skipTimeUnitDropdown = new Dropdown(document.getElementById(SKIP_TIME_UNIT)!, {
      options: [
        { label: getMessage('seconds'), value: 'seconds' },
        { label: getMessage('minutes'), value: 'minutes' },
        { label: getMessage('subtitles'), value: 'subtitles' },
      ],
      initialValue: settings.skipTimeUnit,
      onChange: (value) => (settings.skipTimeUnit = value),
    });

    Object.entries(INPUTS).forEach(([storageKey, inputId]) => {
      inputInstances[storageKey] = this.createInput(inputId, storageKey, settings);
    });

    document.getElementById(BUTTONS.CANCEL)?.addEventListener('click', () => {
      this.resetInputsValue();
      this.updateButtonsVisibility(false);
      skipTimeUnitDropdown.reset();
    });

    document.getElementById(BUTTONS.SAVE)?.addEventListener('click', async () => {
      const response = await setStorage(STORAGE_KEY, settings);
      if (response.success) {
        this.updateButtonsVisibility(false);
        Object.keys(INPUTS).forEach((storageKey) => {
          updateDefaultValue(inputInstances[storageKey], settings[storageKey]);
        });
      } else {
        new Popup(document.getElementById(POPUP_CONTAINER_ID)!, {
          message: response.error.message,
          status: 'error',
          type: 'alert',
        });
      }
    });
  }

  private proxyHandler() {
    const { STORAGE_KEY, BUTTONS, TOGGLE_ID, CONTAINER_ID } = this.props;
    return {
      set(target: VideoSkipConfig, prop: keyof VideoSkipConfig, value: VideoSkipConfig[keyof VideoSkipConfig]) {
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

      get(target: VideoSkipConfig, prop: keyof VideoSkipConfig) {
        if (target[prop] !== undefined) return Reflect.get(target, prop);
        return DEFAULT_CONFIG[STORAGE_KEY][prop];
      },
    };
  }

  private createInput(
    inputId: string,
    storageKey: keyof Omit<VideoSkipConfig, 'enabled' | 'skipTimeUnit'>,
    settings: VideoSkipConfig
  ) {
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
    const { INPUTS } = this.props;
    resetInputValue(INPUTS.backward, { eventType: 'keydown' });
    resetInputValue(INPUTS.forward, { eventType: 'keydown' });
    resetInputValue(INPUTS.skipTime);
  }

  private updateButtonsVisibility(visible: boolean) {
    const { BUTTONS, TOGGLE_ID } = this.props;
    setElementVisibility(BUTTONS.CANCEL, visible);
    setElementVisibility(BUTTONS.SAVE, visible);
    setElementVisibility(TOGGLE_ID, !visible);
  }
}
