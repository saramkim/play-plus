import { html } from 'lit-html';
import { getMessage } from '../utils/i18n';
import Component from '../core/Component';
import { SETTINGS } from '../utils/constants';
import { getStorage, setStorage } from '../utils/storage';
import { DEFAULT_CONFIG } from '../utils/default';
import {
  resetInputValue,
  setButtonAvailabilityWithTag,
  setElementAvailability,
  setupInput,
  updateDefaultValue,
} from '../utils/dom';
import { validate } from '../utils/validation';

const { STORAGE_KEY, INPUTS, BUTTONS } = SETTINGS.SKIP_TIME;

export default class SkipTimeConfigForm extends Component {
  afterRender() {
    this.initializeSkipTimeSetting();
  }

  template() {
    return html`
      <header class="section-header">
        <h2 class="section-title">${getMessage('main_key_section_title')}</h2>
        <div class="row">
          <button id="${BUTTONS.CANCEL}" class="button bg-gray-500" disabled>${getMessage('cancel_button')}</button>
          <button id="${BUTTONS.SAVE}" class="button bg-teal-500" disabled>${getMessage('save_button')}</button>
        </div>
      </header>
      <div class="row">
        <label for="${INPUTS.skipTime}" class="label">${getMessage('video_skip_time_label')}</label>
        <input id="${INPUTS.skipTime}" class="input" type="number" />
      </div>
    `;
  }

  private async initializeSkipTimeSetting() {
    let skipTime = (await getStorage(STORAGE_KEY)) || DEFAULT_CONFIG[STORAGE_KEY];

    const timeInput = setupInput(INPUTS.skipTime, skipTime.toString());
    timeInput.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement;
      skipTime = parseInt(target.value, 10);

      const result = validate(STORAGE_KEY, skipTime);
      setElementAvailability(BUTTONS.CANCEL, true);
      setButtonAvailabilityWithTag(BUTTONS.SAVE, result);
    });

    document.getElementById(BUTTONS.CANCEL)?.addEventListener('click', () => {
      resetInputValue(INPUTS.skipTime);
      setElementAvailability(BUTTONS.CANCEL, false);
      setElementAvailability(BUTTONS.SAVE, false);
    });

    document.getElementById(BUTTONS.SAVE)?.addEventListener('click', async () => {
      await setStorage(STORAGE_KEY, skipTime);
      setElementAvailability(BUTTONS.CANCEL, false);
      setElementAvailability(BUTTONS.SAVE, false);
      updateDefaultValue(timeInput, skipTime);
    });
  }
}
