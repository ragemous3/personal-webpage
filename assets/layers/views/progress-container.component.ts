import { css, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { ProgressServiceContract } from '../shared/contracts/progress-service.contract';
import { Unsubscribeable } from '../shared/utils/subscribable';
import { ProgressInfo } from '../shared/models/progress.model';
import {
  isDoneProgressInfo,
  isProgressStatusInfo,
  isReadyProgressInfo,
} from '../shared/guards/progress.guard';
import { progressContext } from '../../composition/contexts/progress.context';
import { consume } from '@lit/context';
//@ts-ignore

@customElement('progress-container')
export class ProgressContainer extends LitElement {
  /* static styles = css`
    ${progressStyle}
  `; */

  unsubs: Unsubscribeable[] = [];
  @consume({ context: progressContext, subscribe: true })
  progressService!: ProgressServiceContract<Map<string, ProgressInfo>>;

  @state() accessor data: Map<string, ProgressInfo> = new Map();

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    this.unsubs.push(
      this.progressService.connect((message: Map<string, ProgressInfo>): void => {
        this.data = new Map(message);
      }),
    );
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubs.forEach((unsub) => unsub());
  }

  getBar = (key: string, progress: number) =>
    html`<label for="${key}-progress"
      >${key} loading...
      <progress id="${key}-progress" max="100" value="${progress}">${progress}</progress></label
    >`;

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
      ([key]) => key,
      ([key, progress]) => this.getProgress(key, progress),
    )}`;
  }
}
