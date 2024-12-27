import { html } from 'lit-html';
import Component from '../core/Component';

export default class Footer extends Component {
  template() {
    return html`
      <div class="flex justify-center items-center h-8">
        <div class="flex items-center gap-2">
          <img src="icons/play-plus_48x.png" alt="logo" class="w-4" />
          <h1 class="text-[16px] font-bold text-teal-500">Play Plus</h1>
        </div>
      </div>
    `;
  }
}
