import { customElement, state } from 'lit/decorators.js';
import { OgcJob, OgcService } from 'src/features/ogc/ogc.service';
import { CoreElement } from 'src/features/core';
import { consume } from '@lit/context';
import { css, html } from 'lit';
import { applyEffect, applyTypography } from 'src/styles/theme';
import { repeat } from 'lit/directives/repeat.js';
import i18next from 'i18next';

@customElement('ngm-ogc-queue')
export class OgcQueue extends CoreElement {
  @consume({ context: OgcService.context() })
  accessor ogcService!: OgcService;

  @state()
  accessor jobs: OgcJob[] = [];

  connectedCallback() {
    super.connectedCallback();

    this.register(
      this.ogcService.jobs$.subscribe((jobs) => {
        this.jobs = jobs;
        this.classList.toggle('is-hidden', jobs.length === 0);
      }),
    );

    this.classList.add('is-open');
  }

  private readonly toggle = () => {
    this.classList.toggle('is-open');
  };

  readonly render = () => html`
    <div class="title">
      <h2>${i18next.t('toolbox:ogc.queue.title')}</h2>
      <sgc-button
        color="tertiary"
        variant="icon"
        transparent
        @click="${this.toggle}"
      >
        <sgc-icon name="chevronDown"></sgc-icon>
      </sgc-button>
    </div>
    <ul class="jobs">
      ${repeat(this.jobs, (job) => job.id, this.renderJob)}
    </ul>
  `;

  private readonly renderJob = (job: OgcJob) =>
    html`<li><ngm-ogc-queue-item .job="${job}"></ngm-ogc-queue-item></li>`;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      ${applyEffect('overlay-shadow')};

      position: absolute;
      left: calc(8px + var(--sidebar-width, 0px));
      bottom: 0;
      background-color: var(--sgc-color-bg--white);
      border: 1px solid var(--sgc-color-border--default);
      z-index: 2;
      width: 380px;
      border-top-left-radius: 4px;
      border-top-right-radius: 4px;
    }

    :host(.is-hidden) {
      display: none;
    }

    .title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 9px 9px 9px 16px;

      background-color: var(--sgc-color-bg--grey);
    }

    .title h2 {
      margin: 0;
      ${applyTypography('body-2-bold')};
    }

    :host(:not(.is-open)) .title sgc-button {
      transform: rotate(180deg);
    }

    ul.jobs {
      list-style: none;
      padding: 16px;
      margin: 0;
    }

    :host(:not(.is-open)) ul.jobs {
      max-height: 0;
      padding: 0;
    }
  `;
}
