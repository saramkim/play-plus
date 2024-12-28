import { html } from 'lit-html';
import SavedSubtitlesPage from './ui/SavedSubtitlesPage';
import SubtitleSettingPage from './ui/SubtitleSettingPage';
import VideoSettingPage from './ui/VideoSettingPage';
import { PAGE_NAME, PageName, POPUP_CONTAINER_ID } from './utils/constants';
import Header from './components/Header';
import Component from './core/Component';
import { getLocalStorage, setLocalStorage } from './utils/storage';
import Footer from './components/Footer';

const { SUBTITLE_SETTING, VIDEO_SETTING, SAVED_SUBTITLES } = PAGE_NAME;

const PAGE_MAP = {
  [SUBTITLE_SETTING]: SubtitleSettingPage,
  [VIDEO_SETTING]: VideoSettingPage,
  [SAVED_SUBTITLES]: SavedSubtitlesPage,
};

const HEADER_ID = 'header';
const MAIN_ID = 'main';
const FOOTER_ID = 'footer';

export default class App extends Component {
  private removePage?: () => void;
  private currentPage?: PageName;

  async onMount() {
    const lastViewedPage = await getLocalStorage('lastViewedPage');
    const initialPage = lastViewedPage && PAGE_MAP[lastViewedPage] ? lastViewedPage : SUBTITLE_SETTING;
    this.renderHeader(initialPage);
    this.renderFooter();
    this.navigate(initialPage);
  }

  template() {
    return html`
      <header id="${HEADER_ID}" class="border-b border-b-gray-300"></header>
      <main id="${MAIN_ID}" class="h-full overflow-auto p-4"></main>
      <footer id="${FOOTER_ID}" class="border-t border-t-gray-300"></footer>

      <div id="${POPUP_CONTAINER_ID}" class="absolute"></div>
    `;
  }

  private renderHeader(initialPage: PageName) {
    const props = {
      initialPage,
      onNavigate: this.navigate.bind(this),
    };
    new Header(document.getElementById(HEADER_ID)!, props);
  }

  private renderFooter() {
    new Footer(document.getElementById(FOOTER_ID)!);
  }

  private navigate(name: PageName) {
    if (this.currentPage === name) return;

    this.removePage?.();

    const Page = PAGE_MAP[name];
    const page = new Page(document.getElementById(MAIN_ID)!);

    this.removePage = () => page.destroy();
    this.currentPage = name;
    setLocalStorage('lastViewedPage', name);
  }
}
