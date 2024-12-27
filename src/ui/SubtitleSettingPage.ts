import { html } from 'lit-html';
import Component from '../core/Component';
import SubtitleConfigForm from './SubtitleConfigForm';
import { SETTINGS } from '../utils/constants';

const { PRIMARY, SECONDARY } = SETTINGS.SUBTITLES;

export default class SubtitleSettingPage extends Component {
  afterRender() {
    this.initiaizeSettingComponents();
  }

  template() {
    return html`
      <div class="flex flex-col gap-5">
        <section id="${PRIMARY.SECTION_ID}" class="section"></section>
        <section id="${SECONDARY.SECTION_ID}" class="section"></section>
      </div>
    `;
  }

  private initiaizeSettingComponents() {
    const getContainer = (sectionId: string) => document.getElementById(sectionId)!;

    new SubtitleConfigForm(getContainer(PRIMARY.SECTION_ID), PRIMARY);
    new SubtitleConfigForm(getContainer(SECONDARY.SECTION_ID), SECONDARY);
  }
}
