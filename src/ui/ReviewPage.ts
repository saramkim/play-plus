import { REVIEW } from '../utils/constants';
import { getLocalStorage, onLocalStorageChange, SavedSubtitle, setLocalStorage } from '../utils/storage';
import { html } from 'lit-html';
import Component from '../core/Component';
import SavedSubtitleItems from './SavedSubtitleItems';
import SavedSubtitleHeader from './SavedSubtitleHeader';

const { STORAGE_KEY, HEADER_ID, CONTAINER_ID, ACTIONS } = REVIEW;

export default class ReviewPage extends Component {
  private subtitles: { original: SavedSubtitle[]; current: SavedSubtitle[] } = { original: [], current: [] };
  private removeStorageChangeListener?: () => void;

  async initialize() {
    this.setupStorageListener();
  }

  onMount() {
    this.renderHeader();
    this.loadSubtitles();
  }

  onUnmount() {
    this.removeStorageChangeListener?.();
  }

  template() {
    return html`
      <div class="flex flex-col h-full">
        <header id="${HEADER_ID}" class="flex justify-between items-center pb-2 border-b"></header>
        <div id="${CONTAINER_ID}" class="flex flex-col gap-1 h-full overflow-auto"></div>
      </div>
    `;
  }

  private setupStorageListener() {
    const { remove } = onLocalStorageChange((changes) => {
      const reviewChanges = changes[STORAGE_KEY];
      if (reviewChanges?.newValue) this.updateSubtitles(reviewChanges.newValue);
    });
    this.removeStorageChangeListener = remove;
  }

  private async loadSubtitles() {
    const data = await getLocalStorage(STORAGE_KEY);
    if (data) this.updateSubtitles(data);
  }

  private updateSubtitles(data: SavedSubtitle[]) {
    this.subtitles = { original: data, current: [...data] };
    this.renderItems(data);
  }

  private renderHeader() {
    const container = document.getElementById(HEADER_ID)!;
    new SavedSubtitleHeader(container, {
      onCancel: () => {
        this.subtitles.current = [...this.subtitles.original];
        this.renderItems(this.subtitles.original, false);
      },
      onSave: this.saveSubtitles.bind(this),
      onEdit: () => this.renderItems(this.subtitles.original, true),
    });
  }

  private renderItems(subtitles: SavedSubtitle[], isEditMode = false) {
    const container = document.getElementById(CONTAINER_ID)!;
    new SavedSubtitleItems(container, {
      subtitles,
      isEditMode,
      onDelete: this.deleteSubtitle.bind(this),
      onViewVideo: this.viewVideo.bind(this),
    });
  }

  private saveSubtitles() {
    if (this.subtitles.current === this.subtitles.original) {
      this.renderItems(this.subtitles.original, false);
    } else {
      setLocalStorage(STORAGE_KEY, this.subtitles.current);
    }
  }

  private deleteSubtitle(content: string) {
    this.subtitles.current = this.subtitles.current.filter((subtitle) => subtitle.content !== content);
    this.renderItems(this.subtitles.current, true);
  }

  private viewVideo(url: string, startTime: number) {
    chrome.runtime.sendMessage({ action: ACTIONS.VIEW_VIDEO, url, startTime });
  }
}
