import { CoreElement } from 'src/features/core';
import { customElement, state } from 'lit/decorators.js';
import { html } from 'lit';
import { consume } from '@lit/context';
import DashboardStore from 'src/store/dashboard';
import { SessionService } from 'src/features/session/session.service';
import { User } from 'src/features/session';

@customElement('ngm-session')
export class SessionElement extends CoreElement {
  @consume({ context: SessionService.context() })
  accessor sessionService!: SessionService;

  @state()
  accessor user!: User | null;

  connectedCallback(): void {
    super.connectedCallback();

    this.sessionService.user$.subscribe((user) => {
      this.user = user;
      this.requestUpdate();
    });
  }

  private readonly handleSignIn = (): void => {
    if (this.user !== null) {
      return;
    }
    this.sessionService.signIn();
  };

  private readonly handleSignOut = (): void => {
    if (DashboardStore.projectMode.value === 'edit') {
      DashboardStore.showSaveOrCancelWarning(true);
      return;
    }
    this.sessionService.signOut();
  };

  readonly render = () => html`
    <sgc-session
      .user="${this.user}"
      @sgcSignIn="${this.handleSignIn}"
      @sgcSignOut="${this.handleSignOut}"
    ></sgc-session>
  `;
}
