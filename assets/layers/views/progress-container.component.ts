import { consume } from '@lit/context';
import { html, LitElement, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

import { type ProgressServiceContract } from '@/layers/shared/contracts/progress-service.contract';
import {
  isDoneProgressInfo,
  isProgressStatusInfo,
  isReadyProgressInfo,
} from '@/layers/shared/guards/progress.guard';
import { type ProgressInfo } from '@/layers/shared/models/progress.model';
import { type Unsubscribeable } from '@/layers/shared/utils/subscribable';
import { progressContext } from '@/layers/views/context/progress.context';

@customElement('progress-container')
export class ProgressContainer extends LitElement {
  unsubs: Unsubscribeable[] = [];
  @consume({ context: progressContext, subscribe: true })
  progressService!: ProgressServiceContract<Map<string, ProgressInfo>>;

  @state() accessor data = new Map<string, ProgressInfo>();

  connectedCallback(): void {
    super.connectedCallback();
    this.unsubs.push(
      this.progressService.connect((message: Map<string, ProgressInfo>): void => {
        this.data = new Map(message);
      }),
    );
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const unsub of this.unsubs) unsub();
  }

  getBar = (key: string, progress: number): TemplateResult<1> => html`
    <label for="${key}-progress"
      >${key} loading...
      <progress id="${key}-progress" max="100" value="${progress}">${progress}</progress></label
    >
  `;

  getProgress = (key: string, progress: ProgressInfo): TemplateResult<1> => {
    if (isProgressStatusInfo(progress)) {
      return this.getBar(key, progress.progress);
    }

    if (isDoneProgressInfo(progress)) {
      return html`${this.getBar(key, 100)} - ${progress.status} ✅`;
    }

    if (isReadyProgressInfo(progress)) {
      return html`${this.getBar(key, 100)} - ${progress.status} ✅`;
    }

    return html``;
  };

  render(): TemplateResult {
    return html`${repeat(
      [...this.data.entries()],
      ([key]): string => key,
      ([key, progress]): TemplateResult<1> => this.getProgress(key, progress),
    )}`;
  }
}
