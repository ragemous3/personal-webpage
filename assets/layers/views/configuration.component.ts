import { consume } from '@lit/context';
import { html, LitElement, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import {
  type AssistantSettings,
  type ConfigurationServiceContract,
  type ConfigurationState,
} from '@/layers/shared/contracts/configuration-service.contract';
import { configurationContext } from '@/layers/views/context/configuration.context';

@customElement('assistant-configuration')
export class AssistantConfiguration extends LitElement {
  @consume({ context: configurationContext, subscribe: true })
  @property({ attribute: false })
  configurationService?: ConfigurationServiceContract;
  @state() private configuration?: ConfigurationState;
  @state() private feedback = '';
  #bound: ConfigurationServiceContract | undefined;
  #unsubscribe: (() => void) | undefined;

  connectedCallback(): void {
    super.connectedCallback();
    this.#bind();
  }

  disconnectedCallback(): void {
    this.#unsubscribe?.();
    this.#bound = undefined;
    super.disconnectedCallback();
  }

  #bind(): void {
    if (!this.isConnected || this.#bound === this.configurationService) return;
    this.#unsubscribe?.();
    this.#bound = this.configurationService;
    this.#unsubscribe = this.configurationService?.stateSubscription.connect((value) => {
      this.configuration = value;
    });
  }

  readonly #edit = (event: Event): void => {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    if (!this.configuration) return;
    if (!input.checkValidity()) {
      this.feedback = `${input.name}: ${input.validationMessage}`;
      return;
    }
    let value: string | number | boolean = input.value;
    if (input instanceof HTMLInputElement) {
      value = input.type === 'checkbox' ? input.checked : input.valueAsNumber;
    }
    const next = { ...this.configuration.selected, [input.name]: value } as AssistantSettings;
    this.feedback = this.configurationService?.update(next) ? '' : `${input.name}: Invalid setting`;
  };

  render(): TemplateResult {
    const state = this.configuration;
    if (!state) return html`<p role="status">Loading settings</p>`;
    const settings = state.selected;
    return html`
      <fieldset>
        <legend>Assistant settings</legend>
        <label
          >Mode
          <select name="mode" .value=${settings.mode} @change=${this.#edit}>
            <option value="local">Local</option>
            <option value="online">Online</option>
          </select></label
        >
        <label
          >Model
          <select name="model" .value=${settings.model} @change=${this.#edit}>
            <option value="Xenova/Qwen1.5-0.5B-Chat">Qwen1.5 0.5B Chat</option>
          </select></label
        >
        <label
          >Execution
          <select name="execution" .value=${settings.execution} @change=${this.#edit}>
            <option value="auto">Auto</option>
            <option value="wasm">CPU</option>
            <option value="webgpu">WebGPU</option>
          </select></label
        >
        ${this.#advanced(settings)}
      </fieldset>
      ${this.#status(state)}
    `;
  }

  protected updated(_changed: PropertyValues): void {
    this.#bind();
  }

  #advanced(settings: AssistantSettings): TemplateResult {
    return html`
      <details>
        <summary>Advanced</summary>
        <label>Precision
          <select name="precision" .value=${settings.precision} @change=${this.#edit}>
            <option value="q4">Q4</option><option value="auto">Auto</option>
          </select>
        </label>
        <label>Maximum new tokens
          <input name="maxNewTokens" type="number" min="1" max="1024" step="1" required
            .value=${String(settings.maxNewTokens)} @input=${this.#edit} />
        </label>
        <label><input name="sampling" type="checkbox" .checked=${settings.sampling}
          @change=${this.#edit} />Sampling</label>
        ${settings.sampling ? html`
          <label>Temperature
            <input name="temperature" type="number" min="0.1" max="2" step="any" required
              .value=${String(settings.temperature)} @input=${this.#edit} />
          </label>
          <label>Top-p
            <input name="topP" type="number" min="0" max="1" step="any" required
              .value=${String(settings.topP)} @input=${this.#edit} />
          </label>
        ` : ''}
      </details>
    `;
  }

  #status(state: ConfigurationState): TemplateResult {
    return html`
      ${this.feedback ? html`<p role="alert">${this.feedback}</p>` : ''}
      ${state.notice ? html`<p role="status">${state.notice}</p>` : ''}
      ${this.#pendingStatus(state)}
      ${state.selected.mode === 'online'
        ? html`<p role="status">Online mode is not available yet</p>`
        : ''}
      ${state.error
        ? html`
          <p role="alert">${state.error}</p>
          <button @click=${() => this.configurationService?.retry()}>Retry settings</button>
          ${state.canSwitchBack
              ? html`
                <button @click=${() => this.configurationService?.switchBack()}>
                                  Switch back
                                </button>
              `
              : ''}
        `
        : ''}
      <button @click=${() => this.configurationService?.restoreDefaults()}>Restore defaults</button>
    `;
  }

  #pendingStatus(state: ConfigurationState): TemplateResult {
    if (!state.pending || state.error) return html``;
    return html`<p role="status">${state.loading ? 'Loading selected settings' : 'Settings will apply after this response'}</p>`;
  }
}
