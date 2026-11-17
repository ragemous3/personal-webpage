import { css, html, LitElement, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { type TalkingHeadServiceContract } from '@/layers/shared/contracts/talking-head-service.contract';
import { type TalkingHeadState } from '@/layers/shared/models/speech.model';

@customElement('talking-head')
export class TalkingHeadComponent extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    #head {
      width: 320px;
      height: 320px;
      max-width: 100%;
      margin-inline: auto;
    }
  `;
  @property({ attribute: false }) service?: TalkingHeadServiceContract;
  @state() private lifecycle: TalkingHeadState = { status: 'disabled' };
  #bound: TalkingHeadServiceContract | undefined;
  #disconnect: (() => void) | undefined;
  disconnectedCallback(): void {
    this.service?.dispose();
    this.#disconnect?.();
    this.#bound = undefined;
    super.disconnectedCallback();
  }
  render(): TemplateResult {
    return html`
      <div id="head" role="img" aria-label="Talking assistant"></div>
      <button
        @click=${() => this.service?.enable()}
        ?disabled=${this.lifecycle.status !== 'disabled' && this.lifecycle.status !== 'error'}
      >
        Enable speech
      </button>
      <button @click=${() => this.service?.stop()}>Stop speech</button>
      <p role="status">${this.lifecycle.error ?? this.lifecycle.status}</p>
    `;
  }
  protected updated(_changes: PropertyValues): void {
    if (!this.service || this.#bound === this.service) return;
    this.#disconnect?.();
    this.#bound = this.service;
    this.#disconnect = this.service.stateSubscription.connect((state) => {
      this.lifecycle = state;
    });
    const host = this.renderRoot.querySelector<HTMLElement>('#head');
    if (host) void this.service.mount(host);
  }
}
