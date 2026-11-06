import { consume } from '@lit/context';
import { html, LitElement, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';

import { type ConfigurationServiceContract } from '@/layers/shared/contracts/configuration-service.contract';
import { type AssistantSettings } from '@/layers/shared/models/assistant-settings.model';
import { configurationContext } from '@/layers/views/context/configuration.context';

@customElement('chatbot-host')
export class ChatbotHost extends LitElement {
  @consume({ context: configurationContext, subscribe: true })
  @property({ attribute: false })
  configuration?: ConfigurationServiceContract;
  @property({ attribute: false }) offline?: TemplateResult;
  @property({ attribute: false }) online?: TemplateResult;
  @state() mounted: AssistantSettings | undefined;
  #bound: ConfigurationServiceContract | undefined;
  #disconnect: (() => void) | undefined;

  disconnectedCallback(): void {
    this.#disconnect?.();
    this.#bound = undefined;
    super.disconnectedCallback();
  }

  render(): TemplateResult {
    const settings = this.mounted;
    return html`${settings
      ? keyed(JSON.stringify(settings), settings.mode === 'local' ? this.offline : this.online)
      : html`<p role="status">initializing</p>`}`;
  }
  protected willUpdate(): void {
    if (this.#bound === this.configuration) return;
    this.#disconnect?.();
    this.#bound = this.configuration;
    this.#disconnect = this.configuration?.stateSubscription.connect((value) => {
      this.mounted = value.mounted;
    });
  }
}
