import { ContextProvider } from '@lit/context';
//@ts-expect-error - Comes from Hugo
import * as config from '@params/config';
import { html, LitElement, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';

import { progressContext } from '@/layers/views/context/progress.context';

import { progressFactory } from './factories/progress.factory';

@customElement('progress-provider')
export class ProgressProvider extends LitElement {
  readonly _provide = new ContextProvider(this, {
    context: progressContext,
    initialValue: progressFactory(config),
  });

  render(): TemplateResult<1> {
    return html`<progress-container></progress-container>`;
  }
}
