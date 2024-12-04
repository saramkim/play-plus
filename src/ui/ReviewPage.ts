import './review.css';
import { COUPANG_PLAY_BASE_URL, REVIEW } from '../utils/constants';
import { setElementVisibility } from '../utils/dom';
import { getLocalStorage, onLocalStorageChange, savedSubtitle, setLocalStorage } from '../utils/storage';
import { getMessage } from '../utils/i18n';
import { Tooltip } from '../components/tooltip';
import { html } from 'lit-html';

const { STORAGE_KEY, CONTAINER_ID, TEMPLATE_ID, BUTTONS, ACTIONS } = REVIEW;

export class ReviewPage implements Component {
  private savedSubtitleCache: savedSubtitle[] = [];
  private deletedSubtitleContentList: string[] = [];
  private viewVideoText = getMessage('view_video');

  async init() {
    await this.initializeReviewData();
    this.initializeStorageChange();
    this.initializeButtons();
  }

  html() {
    return html`
      <div class="flex flex-col h-full">
        <header class="flex justify-between items-center pb-2 border-b">
          <h2 class="section-title">${getMessage('saved_subtitles')}</h2>
          <div class="row">
            <button id="cancel-saved-subtitle-setting" class="button bg-gray-500 hidden">
              ${getMessage('cancel_button')}
            </button>
            <button id="save-saved-subtitle-setting" class="button bg-teal-500 hidden">
              ${getMessage('save_button')}
            </button>
            <button id="edit-saved-subtitle-setting" class="button bg-gray-500">${getMessage('edit_button')}</button>
          </div>
        </header>
        <div id="saved-subtitle-container" class="flex flex-col gap-1 h-full overflow-auto"></div>
      </div>

      <template id="saved-subtitle-template">
        <div data-role="saved-subtitle-item" class="flex flex-col gap-2 py-2 border-b">
          <div class="flex justify-between items-center">
            <p data-role="content" class="text-[15px] font-medium text-wrap select-text w-full"></p>
            <button data-role="delete-button" class="text-rose-500 font-bold hidden">✖</button>
          </div>
          <div class="flex justify-between items-center">
            <button data-role="view-button" class="bg-gray-200 px-1 rounded disabled:opacity-30"></button>
            <p data-role="saved-at" class="text-gray-800"></p>
          </div>
        </div>
      </template>
    `;
  }

  private initializeButtons() {
    const { EDIT, CANCEL, SAVE } = BUTTONS;
    const editButton = document.getElementById(EDIT);
    const cancelButton = document.getElementById(CANCEL);
    const saveButton = document.getElementById(SAVE);

    editButton?.addEventListener('click', () => this.setEditMode(true));
    cancelButton?.addEventListener('click', () => {
      this.setEditMode(false);
      this.updateReviewData(this.savedSubtitleCache);
    });
    saveButton?.addEventListener('click', () => {
      this.setEditMode(false);
      const data = this.savedSubtitleCache.filter(({ content }) => !this.deletedSubtitleContentList.includes(content));
      setLocalStorage(STORAGE_KEY, data);
    });
  }

  private setEditMode(isEditMode: boolean) {
    const { EDIT, CANCEL, SAVE } = BUTTONS;

    setElementVisibility(EDIT, !isEditMode);
    setElementVisibility(CANCEL, isEditMode);
    setElementVisibility(SAVE, isEditMode);
    document.getElementById(CONTAINER_ID)?.classList.toggle('edit-mode', isEditMode);
  }

  private async initializeReviewData() {
    const data = await getLocalStorage(STORAGE_KEY);
    if (data) this.updateReviewData(data);
  }

  private initializeStorageChange() {
    onLocalStorageChange((changes) => {
      const reviewChanges = changes[STORAGE_KEY];
      if (reviewChanges && reviewChanges.newValue) {
        this.updateReviewData(reviewChanges.newValue);
      }
    });
  }

  private updateReviewData(data: savedSubtitle[]) {
    const savedSubtitleContainer = document.getElementById(CONTAINER_ID) as HTMLElement;
    const savedSubtitleTemplate = document.getElementById(TEMPLATE_ID) as HTMLTemplateElement;
    const fragment = document.createDocumentFragment();

    this.savedSubtitleCache = data;
    this.deletedSubtitleContentList = [];

    data.forEach((subtitle) => {
      const clone = this.createSavedSubtitleItem(savedSubtitleTemplate, subtitle);
      fragment.appendChild(clone);
    });

    savedSubtitleContainer.replaceChildren(fragment);
  }

  private createSavedSubtitleItem(template: HTMLTemplateElement, { content, savedAt, url, startTime }: savedSubtitle) {
    const clone = template.content.cloneNode(true) as DocumentFragment;
    const savedSubtitleItem = clone.querySelector('[data-role="saved-subtitle-item"]') as HTMLElement;
    const contentElement = clone.querySelector('[data-role="content"]') as HTMLElement;
    const savedAtElement = clone.querySelector('[data-role="saved-at"]') as HTMLElement;
    const viewButton = clone.querySelector('[data-role="view-button"]') as HTMLButtonElement;
    const deleteButton = clone.querySelector('[data-role="delete-button"]') as HTMLButtonElement;

    contentElement.textContent = content;
    savedAtElement.textContent = new Date(savedAt).toLocaleString();
    viewButton.textContent = this.viewVideoText;

    if (url.startsWith(COUPANG_PLAY_BASE_URL)) {
      viewButton.addEventListener('click', async () => {
        viewButton.disabled = true;
        await chrome.runtime.sendMessage({ action: ACTIONS.VIEW_VIDEO, url, startTime });
        viewButton.disabled = false;
      });
    } else {
      viewButton.disabled = true;
      Tooltip({ message: `${getMessage('error_unsupported_url')} (${url})`, target: viewButton });
    }

    deleteButton.addEventListener('click', () => {
      savedSubtitleItem.remove();
      this.deletedSubtitleContentList.push(content);
    });

    return clone;
  }
}
