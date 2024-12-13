import { html } from 'lit-html';
import Component from '../core/Component';
import { SavedSubtitle } from '../utils/storage';
import { getMessage } from '../utils/i18n';
import { COUPANG_PLAY_BASE_URL } from '../utils/constants';

type SavedSubtitleItemsProps = {
  subtitles: SavedSubtitle[];
  isEditMode: boolean;
  onDelete: (content: string) => void;
  onViewVideo: (url: string, startTime: number) => void;
};

export default class SavedSubtitleItems extends Component<SavedSubtitleItemsProps> {
  template() {
    const { subtitles } = this.props;
    return html`${subtitles.map((subtitle: SavedSubtitle) => this.itemTemplate(subtitle))}`;
  }

  private itemTemplate({ content, savedAt, url, startTime }: SavedSubtitle) {
    const { isEditMode, onDelete, onViewVideo } = this.props;
    return html`
      <div class="flex flex-col gap-2 py-2 border-b">
        <div class="flex justify-between items-center">
          <p class="text-[15px] font-medium text-wrap select-text w-full">${content}</p>
          <button class="text-rose-500 font-bold ${isEditMode ? '' : 'hidden'}" @click="${() => onDelete(content)}">
            ✖
          </button>
        </div>
        <div class="flex justify-between items-center">
          <button
            class="bg-gray-200 px-1 rounded disabled:opacity-30"
            ?disabled="${!url.startsWith(COUPANG_PLAY_BASE_URL)}"
            @click="${() => onViewVideo(url, startTime)}"
          >
            ${getMessage('view_video')}
          </button>
          <p class="text-gray-800">${new Date(savedAt).toLocaleString()}</p>
        </div>
      </div>
    `;
  }
}
