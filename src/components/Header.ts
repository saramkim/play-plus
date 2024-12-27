import { html } from 'lit-html';
import { getMessage } from '../utils/i18n';
import Component from '../core/Component';
import { PAGE_NAME } from '../utils/constants';

const { SUBTITLE_SETTING, VIDEO_SETTING, SAVED_SUBTITLES } = PAGE_NAME;

type PageName = (typeof PAGE_NAME)[keyof typeof PAGE_NAME];

type HeaderProps = {
  initialPage: PageName;
  onNavigate: (name: PageName) => void;
};
export default class Header extends Component<HeaderProps> {
  private pageMap = {
    [SUBTITLE_SETTING]: getMessage('subtitle_setting'),
    [VIDEO_SETTING]: getMessage('video_setting'),
    [SAVED_SUBTITLES]: getMessage('saved_subtitles'),
  };

  async initialize() {
    this.state = {
      currentPage: this.props.initialPage,
    };
  }

  template() {
    return html`
      <div class="flex flex-col px-4 pt-4">
        <div class="flex justify-between items-center gap-2">
          ${Object.entries(this.pageMap).map(([page, text]) => this.buttonTemplate(page, text))}
        </div>
      </div>
    `;
  }

  private buttonTemplate(page: PageName, text: string) {
    const { currentPage } = this.state;
    return html`
      <div
        class="w-full px-1 text-center cursor-pointer text-[15px] ${currentPage === page
          ? 'text-black border-b-2 border-b-black font-bold translate-y-[1px]'
          : 'text-gray-500 font-medium hover:text-black'}"
        @click=${() => this.navigate(page)}
      >
        ${text}
      </div>
    `;
  }

  private navigate(name: PageName) {
    this.setState({ currentPage: name });
    this.props.onNavigate(name);
  }
}
