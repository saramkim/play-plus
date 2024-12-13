import { html } from 'lit-html';
import { getMessage } from '../utils/i18n';
import Component from '../core/Component';

type SavedSubtitleHeaderProps = {
  onCancel: () => void;
  onSave: () => void;
  onEdit: () => void;
};

export default class SavedSubtitleHeader extends Component<SavedSubtitleHeaderProps> {
  initialize(): void {
    this.state = {
      isEditMode: false,
    };
  }

  template() {
    const { isEditMode } = this.state;
    const { onCancel, onSave, onEdit } = this.props;
    return html`
      <h2 class="section-title">${getMessage('saved_subtitles')}</h2>
      <div class="row">
        <button
          class="button bg-gray-500 ${isEditMode ? '' : 'hidden'}"
          @click="${() => {
            onCancel();
            this.setState({ isEditMode: false });
          }}"
        >
          ${getMessage('cancel_button')}
        </button>
        <button
          class="button bg-teal-500 ${isEditMode ? '' : 'hidden'}"
          @click="${() => {
            onSave();
            this.setState({ isEditMode: false });
          }}"
        >
          ${getMessage('save_button')}
        </button>
        <button
          class="button bg-gray-500 ${isEditMode ? 'hidden' : ''}"
          @click="${() => {
            onEdit();
            this.setState({ isEditMode: true });
          }}"
        >
          ${getMessage('edit_button')}
        </button>
      </div>
    `;
  }
}
