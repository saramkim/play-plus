import { html } from 'lit-html';
import Component from '../core/Component';
import VideoSkipConfigForm from './VideoSkipConfigForm';
import SubtitleConfigForm from './SubtitleConfigForm';
import { SETTINGS } from '../utils/constants';

const { SUBTITLES, VIDEO_SKIP, SUB_VIDEO_SKIP } = SETTINGS;

export default class SettingPage extends Component {
  afterRender() {
    this.initiaizeSettingComponents();
  }

  template() {
    return html`
      <div class="flex flex-col gap-5">
        <section id="${SUBTITLES.PRIMARY.SECTION_ID}" class="section"></section>
        <section id="${SUBTITLES.SECONDARY.SECTION_ID}" class="section"></section>
        <section id="${VIDEO_SKIP.SECTION_ID}" class="section"></section>
        <section id="${SUB_VIDEO_SKIP.SECTION_ID}" class="section"></section>
      </div>
    `;
  }

  private initiaizeSettingComponents() {
    const getContainer = (sectionId: string) => document.getElementById(sectionId)!;

    new SubtitleConfigForm(getContainer(SUBTITLES.PRIMARY.SECTION_ID), SUBTITLES.PRIMARY);
    new SubtitleConfigForm(getContainer(SUBTITLES.SECONDARY.SECTION_ID), SUBTITLES.SECONDARY);
    new VideoSkipConfigForm(getContainer(VIDEO_SKIP.SECTION_ID), VIDEO_SKIP);
    new VideoSkipConfigForm(getContainer(SUB_VIDEO_SKIP.SECTION_ID), SUB_VIDEO_SKIP);
  }
}
