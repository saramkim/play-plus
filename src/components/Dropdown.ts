import { html } from 'lit-html';
import Component from '../core/Component';
import { getMessage } from '../utils/i18n';

type Option<Value extends string> = { label: string; value: Value };
interface DropdownProps<Value extends string> {
  options: Option<Value>[];
  initialValue: Value;
  onChange: (value: Value) => void;
}

export default class Dropdown<Value extends string> extends Component<DropdownProps<Value>> {
  async initialize() {
    this.state = { value: this.props.initialValue, isOpen: false };
    this.handleDocumentClick = this.handleDocumentClick.bind(this);
    document.addEventListener('click', this.handleDocumentClick);
  }

  onUnmount() {
    document.removeEventListener('click', this.handleDocumentClick);
  }

  reset() {
    this.setState({ value: this.props.initialValue, isOpen: false });
  }

  template() {
    const { value, isOpen } = this.state;
    const label = this.props.options.find((option) => option.value === value)?.label;

    return html`
      <div class="relative inline-block w-full">
        <button
          @click=${() => this.setState({ ...this.state, isOpen: !isOpen })}
          class="w-full h-7 px-2 flex justify-between items-center border rounded focus:outline-none focus:border-teal-500"
        >
          <span>${label || getMessage('select')}</span>
          <svg class="w-5 h-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06-.02L10 10.586l3.71-3.4a.75.75 0 111.04 1.08l-4.25 3.9a.75.75 0 01-1.06 0l-4.25-3.9a.75.75 0 01-.02-1.06z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
        ${isOpen ? this.optionsTemplate() : null}
      </div>
    `;
  }

  private optionsTemplate() {
    return html`
      <ul class="absolute bg-white mt-1 w-full border rounded shadow-lg z-10 overflow-hidden">
        ${this.props.options.map((v) => this.optionTemplate(v))}
      </ul>
    `;
  }

  private optionTemplate({ label, value }: Option<Value>) {
    return html`
      <li
        @click=${() => this.handleOptionClick(value)}
        class="h-7 px-2 flex items-center cursor-pointer ${this.state.value === value
          ? 'bg-teal-500 text-white'
          : 'hover:bg-teal-100'}"
      >
        ${label}
      </li>
    `;
  }

  private handleDocumentClick(event: MouseEvent) {
    const target = event.target as Node;
    if (this.state.isOpen && !this.container.contains(target)) {
      this.setState({ ...this.state, isOpen: false });
    }
  }

  private handleOptionClick(value: Value) {
    if (this.state.value !== value) this.props.onChange(value);
    this.setState({ value, isOpen: false });
  }
}
