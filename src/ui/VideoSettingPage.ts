import { html } from 'lit-html';
import Component from '../core/Component';
import VideoSkipConfigForm from './VideoSkipConfigForm';
import { SETTINGS } from '../utils/constants';
import ShortcutsConfigForm from './ShortcutsConfigForm';

const { VIDEO_SKIP, SUB_VIDEO_SKIP, SHORTCUTS } = SETTINGS;

export default class VideoSettingPage extends Component {
  afterRender() {
    this.initiaizeSettingComponents();
  }

  template() {
    return html`
      <div class="flex flex-col gap-5">
        <section id="${VIDEO_SKIP.SECTION_ID}" class="section"></section>
        <section id="${SUB_VIDEO_SKIP.SECTION_ID}" class="section"></section>
        <section id="${SHORTCUTS.SECTION_ID}" class="section"></section>
      </div>
    `;
  }

  private initiaizeSettingComponents() {
    const getContainer = (sectionId: string) => document.getElementById(sectionId)!;

    new VideoSkipConfigForm(getContainer(VIDEO_SKIP.SECTION_ID), VIDEO_SKIP);
    new VideoSkipConfigForm(getContainer(SUB_VIDEO_SKIP.SECTION_ID), SUB_VIDEO_SKIP);
    new ShortcutsConfigForm(getContainer(SHORTCUTS.SECTION_ID));
  }
}
