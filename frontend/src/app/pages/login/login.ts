import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { apiError } from '../../core/format';
import { ROLE_HOME } from '../../core/models';
import { SettingsStore } from '../../core/settings.store';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <div class="wrap">
      <div class="hero">
        <div class="sun"></div>
        <div class="waves"></div>
        <div class="hero-text">
          <h1>{{ settings.settings().barName }}</h1>
          <p>Do pedido na mesa à cozinha, na hora. Sem papel, sem grito no balcão.</p>
        </div>
      </div>

      <form class="card login" (ngSubmit)="submit()">
        <div class="logo">
          <img src="favicon.svg" alt="" width="48" height="48" />
          <div>
            <h2>Entrar no BarFlow</h2>
            <span class="muted small">Use o login do seu perfil</span>
          </div>
        </div>

        @if (error()) {
          <div class="error-box">{{ error() }}</div>
        }

        <label class="field">
          <span>Usuário</span>
          <input class="input" name="username" [(ngModel)]="username" autocomplete="username" autocapitalize="none" required />
        </label>
        <label class="field">
          <span>Senha</span>
          <input class="input" name="password" type="password" [(ngModel)]="password" autocomplete="current-password" required />
        </label>

        <button class="btn primary lg block" type="submit" [disabled]="loading() || !username || !password">
          {{ loading() ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>
    </div>
  `,
  styles: `
    .wrap { min-height: 100dvh; display: grid; grid-template-columns: 1.1fr 1fr; }
    .hero {
      position: relative; overflow: hidden;
      background: linear-gradient(180deg, #0e7499 0%, var(--sea-700) 55%, var(--sea-900) 100%);
      color: #fff; display: flex; align-items: flex-end; padding: 48px;
    }
    .sun {
      position: absolute; width: 220px; height: 220px; border-radius: 50%;
      background: radial-gradient(circle, #ffd56b 0%, var(--sun-500) 60%, transparent 61%);
      top: 12%; right: 14%; filter: drop-shadow(0 0 40px rgba(244,178,35,.6));
    }
    .waves {
      position: absolute; left: 0; right: 0; bottom: 0; height: 45%;
      background:
        radial-gradient(60% 30px at 20% 0, transparent 98%, rgba(255,255,255,.08) 100%) 0 0 / 220px 40px repeat-x,
        linear-gradient(180deg, rgba(21,132,168,.0), rgba(8,56,74,.75));
    }
    .hero-text { position: relative; max-width: 460px; }
    .hero-text h1 { font-size: 2.6rem; letter-spacing: -.02em; }
    .hero-text p { font-size: 1.1rem; color: rgba(255,255,255,.85); }
    .login {
      align-self: center; justify-self: center; width: min(400px, calc(100% - 32px));
      display: flex; flex-direction: column; gap: 16px; padding: 28px;
    }
    .logo { display: flex; gap: 12px; align-items: center; }
    @media (max-width: 820px) {
      .wrap { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
      .hero { padding: 28px 20px 36px; min-height: 200px; }
      .hero-text h1 { font-size: 1.8rem; }
      .hero-text p { font-size: .95rem; margin-bottom: 0; }
      .sun { width: 110px; height: 110px; top: 18px; right: 18px; }
      .login { margin: -20px 0 24px; }
    }
  `,
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  protected settings = inject(SettingsStore);

  username = '';
  password = '';
  loading = signal(false);
  error = signal('');

  constructor() {
    if (this.auth.isLoggedIn()) this.router.navigateByUrl(this.auth.home());
  }

  async submit() {
    this.loading.set(true);
    this.error.set('');
    try {
      const user = await this.auth.login(this.username, this.password);
      this.router.navigateByUrl(ROLE_HOME[user.role]);
    } catch (e) {
      this.error.set(apiError(e, 'Não foi possível entrar.'));
    } finally {
      this.loading.set(false);
    }
  }
}
