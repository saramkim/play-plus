import { html } from 'lit-html';
import Component from '../core/Component';
import { getMessage } from '../utils/i18n';

interface PopupPropsBase {
  status: 'success' | 'error' | 'info';
  message: string;
}
interface AlertPopupProps extends PopupPropsBase {
  type: 'alert';
}
interface ConfirmPopupProps extends PopupPropsBase {
  type: 'confirm';
  onConfirm: () => void;
}
type PopupProps = AlertPopupProps | ConfirmPopupProps;

export default class Popup extends Component<PopupProps> {
  private readonly iconMap = {
    success: '✔️',
    error: '❌',
    info: '⚠️',
  };

  template() {
    return html`
      <div class="flex justify-center items-center h-screen w-screen bg-black/50">
        <div class="flex flex-col gap-3 w-[220px] bg-white rounded-md p-4 border border-gray-300 shadow-md">
          <div class="flex flex-col gap-2">
            <header class="flex items-center gap-1 text-[15px]">
              <span>${this.iconMap[this.props.status]}</span>
              <span class="font-bold">${getMessage(this.props.status)}</span>
            </header>
            <p class="whitespace-pre-line">${this.props.message}</p>
          </div>
          ${this.props.type === 'confirm'
            ? this.confirmButtonTemplate(this.props.onConfirm)
            : this.alertButtonTemplate()}
        </div>
      </div>
    `;
  }

  private confirmButtonTemplate(onConfirm: () => void) {
    return html`
      <div class="flex gap-2 w-full">
        <button class="button bg-gray-500 w-full" @click=${() => this.destroy()}>${getMessage('cancel')}</button>
        <button
          class="button bg-teal-500 w-full"
          @click=${() => {
            onConfirm();
            this.destroy();
          }}
        >
          ${getMessage('confirm')}
        </button>
      </div>
    `;
  }

  private alertButtonTemplate() {
    return html`
      <button class="button bg-teal-500 w-full" @click=${() => this.destroy()}>${getMessage('confirm')}</button>
    `;
  }
}
