import './review.css';
import { REVIEW } from '../utils/constants';
import { setElementVisibility } from '../utils/dom';
import { getLocalStorage, onLocalStorageChange, savedSubtitle, setLocalStorage } from '../utils/storage';
import { getMessage } from '../utils/i18n';

const { STORAGE_KEY, CONTAINER_ID, TEMPLATE_ID, BUTTONS } = REVIEW;

class ReviewManager {
  private savedSubtitleCache: savedSubtitle[] = [];
  private deletedSubtitleContentList: string[] = [];
  private watchVideoText: string;

  constructor() {
    this.watchVideoText = getMessage('watch_video');
  }

  async init() {
    await this.initializeReviewData();
    this.initializeStorageChange();
    this.initializeButtons();
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

  private createSavedSubtitleItem(template: HTMLTemplateElement, { content, savedAt, url }: savedSubtitle) {
    const clone = template.content.cloneNode(true) as DocumentFragment;
    const savedSubtitleItem = clone.querySelector('[data-role="saved-subtitle-item"]') as HTMLElement;
    const contentElement = clone.querySelector('[data-role="content"]') as HTMLElement;
    const savedAtElement = clone.querySelector('[data-role="saved-at"]') as HTMLElement;
    const urlElement = clone.querySelector('[data-role="url"]') as HTMLAnchorElement;
    const deleteButton = clone.querySelector('[data-role="delete-button"]') as HTMLButtonElement;

    contentElement.textContent = content;
    savedAtElement.textContent = new Date(savedAt).toLocaleString();
    urlElement.href = url;
    urlElement.textContent = this.watchVideoText;
    deleteButton.addEventListener('click', () => {
      savedSubtitleItem.remove();
      this.deletedSubtitleContentList.push(content);
    });

    return clone;
  }
}

const reviewManager = new ReviewManager();
reviewManager.init();
