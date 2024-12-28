import { COUPANG_PLAY_BASE_URL, REVIEW } from '../utils/constants';
import { getLocalStorage, onLocalStorageChange, SavedSubtitle, setLocalStorage } from '../utils/storage';
import { html } from 'lit-html';
import Component from '../core/Component';
import { getMessage } from '../utils/i18n';

const { STORAGE_KEY, ACTIONS } = REVIEW;
const SEARCH_INPUT_NAME = 'search-input';

export default class ReviewPage extends Component {
  private originalSubtitles: SavedSubtitle[] = [];
  private deletedSubtitles: string[] = [];
  private removeStorageChangeListener?: () => void;

  async initialize() {
    const subtitles = (await getLocalStorage(STORAGE_KEY)) || [];
    this.state = { isEditMode: false, searchText: '', subtitles };
    this.originalSubtitles = subtitles;
    this.setupStorageListener();
  }

  onUnmount() {
    this.removeStorageChangeListener?.();
  }

  template() {
    const { searchText } = this.state;
    return html`
      <div class="flex flex-col h-full">
        <header class="flex flex-col gap-1 pb-1 border-b">
          <div class="flex justify-between items-center">
            ${this.searchFormTemplate()} ${this.editButtonsTemplate()}
          </div>
          <div>${searchText ? this.searchResultTemplate(searchText) : this.allListTemplate()}</div>
        </header>
        <ul class="flex flex-col gap-1 h-full overflow-auto">
          ${this.state.subtitles.map(this.itemTemplate.bind(this))}
        </ul>
      </div>
    `;
  }

  private searchFormTemplate() {
    return html`
      <form class="flex items-center gap-1" @submit="${this.search.bind(this)}">
        <input class="input" name="${SEARCH_INPUT_NAME}" />
        <button class="button bg-teal-500" type="submit">${getMessage('search')}</button>
      </form>
    `;
  }

  private editButtonsTemplate() {
    const { isEditMode } = this.state;
    return html`
      <div class="flex gap-1">
        <button class="button bg-gray-500 ${isEditMode ? '' : 'hidden'}" @click="${this.exitEditMode.bind(this)}">
          ${getMessage('cancel')}
        </button>
        <button class="button bg-teal-500 ${isEditMode ? '' : 'hidden'}" @click="${this.saveSubtitles.bind(this)}">
          ${getMessage('save')}
        </button>
        <button class="button bg-gray-500 ${isEditMode ? 'hidden' : ''}" @click="${this.enterEditMode.bind(this)}">
          ${getMessage('edit')}
        </button>
      </div>
    `;
  }

  private searchResultTemplate(searchText: string) {
    return html`
      <div class="flex items-center gap-1">
        <button
          class="text-rose-500"
          @click="${() => this.setState({ ...this.state, subtitles: this.originalSubtitles, searchText: '' })}"
        >
          ✖
        </button>
        <div class="text-gray-500">
          ${getMessage('search_term')}:
          <span class="font-medium">${searchText}</span>
        </div>
      </div>
    `;
  }

  private allListTemplate() {
    return html`
      <div class="text-gray-500">
        <span class="font-medium">${getMessage('all_list')}</span>
        <span>(${this.state.subtitles.length})</span>
      </div>
    `;
  }

  private itemTemplate({ content, savedAt, url, startTime }: SavedSubtitle) {
    return html`
      <li class="flex flex-col gap-2 py-2 border-b">
        <div class="flex justify-between items-center">
          <p class="text-[15px] font-medium text-wrap select-text w-full">${content}</p>
          <button
            class="text-rose-500 font-bold ${this.state.isEditMode ? '' : 'hidden'}"
            @click="${() => this.delete(content)}"
          >
            ✖
          </button>
        </div>
        <div class="flex justify-between items-center">
          <button
            class="bg-gray-200 px-1 rounded disabled:opacity-30"
            ?disabled="${!url.startsWith(COUPANG_PLAY_BASE_URL)}"
            @click="${() => this.viewVideo(url, startTime)}"
          >
            ${getMessage('view_video')}
          </button>
          <p class="text-gray-800">${new Date(savedAt).toLocaleString()}</p>
        </div>
      </li>
    `;
  }

  private setupStorageListener() {
    const { remove } = onLocalStorageChange((changes) => {
      const reviewChanges = changes[STORAGE_KEY];
      if (reviewChanges?.newValue) {
        const newSubtitles = reviewChanges.newValue;
        this.originalSubtitles = newSubtitles;
        this.setState({ ...this.state, subtitles: newSubtitles });
      }
    });
    this.removeStorageChangeListener = remove;
  }

  private delete(content: string) {
    const newSubtitles = this.state.subtitles.filter((subtitle: SavedSubtitle) => subtitle.content !== content);
    this.setState({ ...this.state, subtitles: newSubtitles });
    this.deletedSubtitles.push(content);
  }

  private viewVideo(url: string, startTime: number) {
    chrome.runtime.sendMessage({ action: ACTIONS.VIEW_VIDEO, url, startTime });
  }

  private enterEditMode() {
    this.setState({ ...this.state, isEditMode: true });
  }

  private exitEditMode() {
    this.setState({ isEditMode: false, searchText: '', subtitles: this.originalSubtitles });
    this.deletedSubtitles = [];
  }

  private async saveSubtitles() {
    if (this.deletedSubtitles.length > 0) {
      const newSubtitles = this.originalSubtitles.filter(({ content }) => !this.deletedSubtitles.includes(content));
      await setLocalStorage(STORAGE_KEY, newSubtitles);
    }
    this.exitEditMode();
  }

  private search(event: SubmitEvent) {
    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    const text = (formData.get(SEARCH_INPUT_NAME) as string).trim();
    const filteredSubtitles = this.originalSubtitles.filter(({ content }) =>
      content.toLowerCase().includes(text.toLowerCase())
    );
    this.setState({ ...this.state, searchText: text, subtitles: filteredSubtitles });
  }
}
