import { html } from 'lit-html';
import Component from '../core/Component';
import { getMessage } from '../utils/i18n';

export default class PrimarySubtitleConfigForm extends Component {
  template() {
    return html`
      <header class="section-header">
        <h2 class="section-title">${getMessage('primary_subtitle_section_title')}</h2>
        <div class="row">
          <button id="cancel-primary-subtitle-setting" class="button bg-gray-500 hidden">
            ${getMessage('cancel_button')}
          </button>
          <button id="save-primary-subtitle-setting" class="button bg-teal-500 hidden" disabled>
            ${getMessage('save_button')}
          </button>
          <div id="primary-subtitle-toggle"></div>
        </div>
      </header>
      <div id="primary-subtitle-setting" class="section">
        <div class="row">
          <label for="primary-subtitle-language" class="label">${getMessage('language_label')}</label>
          <div id="primary-subtitle-language"></div>
        </div>
        <div class="row">
          <label for="primary-subtitle-position-reference" class="label"
            >${getMessage('position_reference_label')}</label
          >
          <div id="primary-subtitle-position-reference"></div>
        </div>
        <div class="row">
          <label for="primary-subtitle-position-offset" class="label">${getMessage('position_offset_label')}</label>
          <input type="number" id="primary-subtitle-position-offset" class="input" />
        </div>
        <div class="row">
          <label for="primary-subtitle-color" class="label">${getMessage('subtitle_color_label')}</label>
          <div id="primary-subtitle-color"></div>
        </div>
        <div class="row">
          <label for="primary-subtitle-font-size" class="label">${getMessage('subtitle_font_size_label')}</label>
          <input type="number" id="primary-subtitle-font-size" class="input" />
        </div>
        <div class="row">
          <label for="primary-subtitle-font-weight" class="label">${getMessage('subtitle_font_weight_label')}</label>
          <input type="number" id="primary-subtitle-font-weight" class="input" />
        </div>
        <div class="row">
          <label for="primary-subtitle-opacity" class="label">${getMessage('subtitle_opacity_label')}</label>
          <input type="number" id="primary-subtitle-opacity" class="input" />
        </div>
        <div class="row">
          <label for="primary-subtitle-line-break" class="label">${getMessage('line_break_label')}</label>
          <input type="checkbox" id="primary-subtitle-line-break" />
        </div>
      </div>
    `;
  }
}
