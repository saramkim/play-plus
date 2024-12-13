import { html, render, TemplateResult } from 'lit-html';

type State = Record<string, any>;

export default abstract class Component<T extends State = never> {
  private readonly container: HTMLElement;
  protected readonly props: T;
  protected state: State = {};

  constructor(container: HTMLElement, props?: T) {
    this.container = container;
    this.props = props ? Object.freeze(props) : (undefined as never);
    this.initialize();
    this.render();
    this.onMount();
  }

  abstract template(): TemplateResult;

  initialize() {}
  render() {
    render(this.template(), this.container);
    this.afterRender();
  }
  afterRender() {}
  onMount() {}
  onUnmount() {}
  destroy() {
    render(html``, this.container);
    this.onUnmount();
  }
  setState(newState: State) {
    const hasChanged = Object.keys(newState).some((key) => this.state[key] !== newState[key]);
    if (!hasChanged) return;
    this.state = newState;
    this.render();
  }
}
