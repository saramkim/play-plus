import { html } from 'lit-html';
import { Switch } from './switch';
import { getMessage } from '../utils/i18n';
import Component from '../core/Component';
import { PAGE_NAME } from '../utils/constants';

const NAV_SWITCH_ID = 'nav-switch';

type PageName = (typeof PAGE_NAME)[keyof typeof PAGE_NAME];

type HeaderProps = {
  onNavigate: (name: PageName) => void;
};
export default class Header extends Component<HeaderProps> {
  afterRender() {
    Switch({
      id: NAV_SWITCH_ID,
      options: [
        { label: getMessage('setting'), value: PAGE_NAME.SETTING },
        { label: getMessage('review'), value: PAGE_NAME.REVIEW },
      ],
      initialValue: PAGE_NAME.SETTING,
      onChange: this.props.onNavigate.bind(this),
      className: ['h-8', 'text-[15px]', 'border-gray-300'],
    });
  }

  template() {
    return html`
      <div class="flex gap-2 items-center w-full">
        <img src="icons/play-plus_48x.png" alt="logo" class="w-8" />
        <h1 class="text-2xl font-bold text-teal-500">Play Plus</h1>
      </div>
      <div id=${NAV_SWITCH_ID}></div>
    `;
  }
}
