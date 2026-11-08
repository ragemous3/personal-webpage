import { consume } from '@lit/context';
import { html, LitElement, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { AssistantModes } from '@/layers/shared/constants/assistant.constant';
import { executionChoices, modeChoices } from '@/layers/shared/constants/assistant-settings.constant';
import { type ConfigurationServiceContract } from '@/layers/shared/contracts/configuration-service.contract';
import { type AssistantSettings, type ConfigurationState } from '@/layers/shared/models/assistant-settings.model';
import { type SettingChoice } from '@/layers/shared/models/model-metadata.model';
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
    const next = { ...this.configuration.selected, [input.name]: value };
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
            ${this.#options(modeChoices, settings.mode)}
          </select></label
        >
        ${this.#modelControl(state)}
        <label ?hidden=${settings.mode === AssistantModes.ONLINE}
          >Execution
          <select name="execution" .value=${settings.execution} @change=${this.#edit}>
            ${this.#options(executionChoices, settings.execution)}
          </select></label
        >
        ${settings.mode === AssistantModes.ONLINE ? this.#onlineControls(settings) : this.#advanced(settings)}
      </fieldset>
      ${state.metadataLoading ? html`<p role="status">Loading model options</p>` : html``}
      ${state.metadataError
        ? html`
          <p role="status">${state.metadataError}</p>
          <button
            @click=${() => {
                void this.configurationService?.refreshOptions();
              }}
          >
            Retry model options
          </button>
        `
        : html``}
      ${this.#status(state)}
    `;
  }

  protected updated(_changed: PropertyValues): void {
    this.#bind();
  }

  #options(choices: readonly SettingChoice[], selected: string): TemplateResult[] {
    return choices.map(
      ({ value, label }) =>
        html`<option value=${value} .selected=${value === selected}>${label}</option>`,
    );
  }

  #modelControl(state: ConfigurationState): TemplateResult {
    const online = state.selected.mode === AssistantModes.ONLINE;
    const selected = online ? state.selected.onlineModel ?? '' : state.selected.model;
    return html`
      <label>Model<select name=${online ? 'onlineModel' : 'model'} @change=${this.#edit}>
            ${this.#options(state.choices?.models ?? [{ value: selected, label: selected }], selected)}
          </select></label>
    `;
  }

  #onlineControls(settings: AssistantSettings): TemplateResult {
    return html`
      <p>Reasoning effort: ${this.configuration?.choices?.reasoningEffort ?? 'low'}</p>
      ${this.#tokens(settings)}
    `;
  }

  #advanced(settings: AssistantSettings): TemplateResult {
    return html`
      <details>
        <summary>Advanced</summary>
        <label
          >Precision
          <select name="precision" .value=${settings.precision} @change=${this.#edit}>
            ${this.#options(
              this.configuration?.choices?.precisions ?? [
                { value: settings.precision, label: settings.precision.toUpperCase() },
              ],
              settings.precision,
            )}
            ${this.configuration?.choices?.precisions.some(
              ({ value }) => value === settings.precision,
            ) === false
              ? html`
                <option value=${settings.precision} .selected=${true} disabled>
                  ${settings.precision.toUpperCase()} (unavailable)
                </option>
              `
              : html``}
          </select>
        </label>
        ${this.#tokens(settings)}
        <label
          ><input
            name="sampling"
            type="checkbox"
            .checked=${settings.sampling}
            @change=${this.#edit}
          />Sampling</label
        >
        ${settings.sampling
          ? html`
            <label
              >Temperature
              <input
                name="temperature"
                type="number"
                min="0.1"
                max="2"
                step="any"
                required
                .value=${String(settings.temperature)}
                @input=${this.#edit}
              />
            </label>
            <label
              >Top-p
              <input
                name="topP"
                type="number"
                min="0"
                max="1"
                step="any"
                required
                .value=${String(settings.topP)}
                @input=${this.#edit}
              />
            </label>
          `
          : ''}
      </details>
    `;
  }

  #status(state: ConfigurationState): TemplateResult {
    return html`
      ${this.feedback ? html`<p role="alert">${this.feedback}</p>` : ''}
      ${state.notice ? html`<p role="status">${state.notice}</p>` : ''}
      ${this.#pendingStatus(state)}
      ${state.selected.mode === AssistantModes.ONLINE && !state.selected.onlineModel
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

  #tokens(settings: AssistantSettings): TemplateResult {
    return html`
      <label>${settings.mode === AssistantModes.ONLINE ? 'Maximum output tokens (includes reasoning)' : 'Maximum new tokens'}
            <input name="maxNewTokens" type="number" min="1"
              max=${this.configuration?.choices?.maxOutputTokens ?? 1024} step="1" required
              .value=${String(settings.maxNewTokens)} @input=${this.#edit} />
          </label>
    `;
  }

  #pendingStatus(state: ConfigurationState): TemplateResult {
    if (!state.pending || state.error) return html``;
    return html`
      <p role="status">
        ${state.loading ? 'Loading selected settings' : 'Settings will apply after this response'}
      </p>
    `;
  }
}
