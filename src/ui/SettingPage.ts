import { html } from 'lit-html';
import Component from '../core/Component';
import SubKeyConfigForm from './SubKeyConfigForm';
import SkipTimeConfigForm from './SkipTimeConfigForm';
import SubtitleConfigForm from './SubtitleConfigForm';
import { SETTINGS } from '../utils/constants';

const { SUBTITLES, SKIP_TIME, SUB_KEY } = SETTINGS;

export default class SettingPage extends Component {
  afterRender() {
    this.initiaizeSettingComponents();
  }

  template() {
    return html`
      <div class="flex flex-col gap-5">
        <section id="${SUBTITLES.PRIMARY.SECTION_ID}" class="section"></section>
        <section id="${SUBTITLES.SECONDARY.SECTION_ID}" class="section"></section>
        <section id="${SKIP_TIME.SECTION_ID}" class="section"></section>
        <section id="${SUB_KEY.SECTION_ID}" class="section"></section>
      </div>
    `;
  }

  private initiaizeSettingComponents() {
    const getContainer = (sectionId: string) => document.getElementById(sectionId)!;

    new SubtitleConfigForm(getContainer(SUBTITLES.PRIMARY.SECTION_ID), SUBTITLES.PRIMARY);
    new SubtitleConfigForm(getContainer(SUBTITLES.SECONDARY.SECTION_ID), SUBTITLES.SECONDARY);
    new SubKeyConfigForm(getContainer(SUB_KEY.SECTION_ID));
    new SkipTimeConfigForm(getContainer(SKIP_TIME.SECTION_ID));
  }
}
