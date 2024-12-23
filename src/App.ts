import { html } from 'lit-html';
import ReviewPage from './ui/ReviewPage';
import SettingPage from './ui/SettingPage';
import { PAGE_NAME, PageName } from './utils/constants';
import Header from './components/Header';
import Component from './core/Component';
import { getLocalStorage, setLocalStorage } from './utils/storage';

const PAGE_MAP = {
  [PAGE_NAME.SETTING]: SettingPage,
  [PAGE_NAME.REVIEW]: ReviewPage,
};

const HEADER_ID = 'header';
const MAIN_ID = 'main';

export default class App extends Component {
  private removePage?: () => void;

  async onMount() {
    const initialPage = (await getLocalStorage('lastViewedPage')) || PAGE_NAME.SETTING;
    this.renderHeader(initialPage);
    this.navigate(initialPage);
  }

  template() {
    return html`
      <header id="${HEADER_ID}" class="flex justify-between items-center p-4 border-b border-b-gray-300"></header>
      <main id="${MAIN_ID}" class="h-full overflow-auto p-4"></main>
    `;
  }

  private renderHeader(initialPage: PageName) {
    const props = {
      initialPage,
      onNavigate: this.navigate.bind(this),
    };
    new Header(document.getElementById(HEADER_ID)!, props);
  }

  private navigate(name: PageName) {
    this.removePage?.();
    const Page = PAGE_MAP[name];
    const page = new Page(document.getElementById(MAIN_ID)!);
    this.removePage = () => page.destroy();
    setLocalStorage('lastViewedPage', name);
  }
}
