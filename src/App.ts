import { html } from 'lit-html';
import ReviewPage from './ui/ReviewPage';
import SettingPage from './ui/SettingPage';
import { PAGE_NAME } from './utils/constants';
import Header from './components/Header';
import Component from './core/Component';

type PageName = (typeof PAGE_NAME)[keyof typeof PAGE_NAME];

const PAGE_MAP = {
  [PAGE_NAME.SETTING]: SettingPage,
  [PAGE_NAME.REVIEW]: ReviewPage,
};

const HEADER_ID = 'header';
const MAIN_ID = 'main';

export default class App extends Component {
  private removePage?: () => void;

  onMount(): void {
    this.renderHeader();
    this.navigate(PAGE_NAME.SETTING);
  }

  template() {
    return html`
      <header id="${HEADER_ID}" class="flex justify-between items-center p-4 border-b border-b-gray-300"></header>
      <main id="${MAIN_ID}" class="h-full overflow-auto p-4"></main>
    `;
  }

  private renderHeader() {
    const props = { onNavigate: this.navigate.bind(this) };
    new Header(document.getElementById(HEADER_ID)!, props);
  }

  private navigate(name: PageName) {
    this.removePage?.();
    const Page = PAGE_MAP[name];
    const page = new Page(document.getElementById(MAIN_ID)!);
    this.removePage = () => page.destroy();
  }
}
