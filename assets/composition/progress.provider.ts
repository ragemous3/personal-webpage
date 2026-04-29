//@ts-ignore
import * as config from '@params/config';
//@ts-ignore
import * as params from '@params';
import { html, LitElement } from 'lit';
import { ContextProvider } from '@lit/context';

import { customElement } from 'lit/decorators.js';
import { progressContext } from './contexts/progress.context';
import { progressFactory } from './factories/progress.factory';

@customElement('progress-provider')
export class ProgressProvider extends LitElement {
  // IGNORING ERROR SINCE USED ONLY BY LIT
  // @ts-ignore
  private _provide = new ContextProvider(this, {
    context: progressContext,
    initialValue: progressFactory(),
  });

  render() {
    return html`<progress-container></progress-container>`;
  }
}
