import { html, render } from 'lit-html';
import { ReviewPage } from '../ui/ReviewPage';
import { SettingPage } from '../ui/SettingPage';
import { Switch } from './switch';
import { getMessage } from '../utils/i18n';

type PageName = 'setting' | 'review';

const NAV_SWITCH_ID = 'nav-switch';

export class Header implements Component {
  private initailPage: PageName;
  private pageMap = {
    setting: new SettingPage(),
    review: new ReviewPage(),
  };

  constructor(initailPage: PageName) {
    this.initailPage = initailPage;
  }

  init() {
    Switch({
      id: NAV_SWITCH_ID,
      options: [
        { label: getMessage('setting'), value: 'setting' },
        { label: getMessage('review'), value: 'review' },
      ],
      initialValue: this.initailPage,
      onChange: (v) => this.navigate(v),
      className: ['h-8', 'text-[15px]', 'border-gray-300'],
    });

    return this.navigate(this.initailPage);
  }

  html() {
    return html`
      <div class="flex gap-2 items-center w-full">
        <img src="icons/play-plus_48x.png" alt="logo" class="w-8" />
        <h1 class="text-2xl font-bold text-teal-500">Play Plus</h1>
      </div>
      <div id=${NAV_SWITCH_ID}></div>
    `;
  }

  private navigate = async (name: PageName) => {
    const page = this.pageMap[name];

    render(page.html(), document.getElementById('main')!);

    return page.init();
  };
}
