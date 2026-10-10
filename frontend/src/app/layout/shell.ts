import { Component, computed, inject, OnDestroy, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ROLE_LABEL, UserRole } from '../core/models';
import { RealtimeService } from '../core/realtime.service';
import { SettingsStore } from '../core/settings.store';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  roles: UserRole[];
}

const NAV: NavItem[] = [
  { path: '/garcom', label: 'Garçom', icon: '📝', roles: ['Garcom', 'Gestor'] },
  { path: '/cozinha', label: 'Cozinha', icon: '🍳', roles: ['Cozinha', 'Gestor'] },
  { path: '/caixa', label: 'Caixa', icon: '💵', roles: ['Caixa', 'Gestor'] },
  { path: '/gestor', label: 'Gestão', icon: '📊', roles: ['Gestor'] },
];

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="top">
      <a class="brand" routerLink="/">
        <img src="favicon.svg" alt="" width="34" height="34" />
        <span class="brand-text">
          <strong>{{ settings.settings().barName }}</strong>
          <small>BarFlow · pedidos</small>
        </span>
      </a>

      @if (nav().length > 1) {
        <nav class="nav">
          @for (n of nav(); track n.path) {
            <a [routerLink]="n.path" routerLinkActive="active">
              <span aria-hidden="true">{{ n.icon }}</span><span class="lbl">{{ n.label }}</span>
            </a>
          }
        </nav>
      }

      <div class="right">
        <span class="conn" [class]="rt.state()" [title]="connTitle()">
          <i></i><span class="hide-sm">{{ connLabel() }}</span>
        </span>
        <span class="who hide-sm">
          {{ auth.user()?.name }}
          <small>{{ roleLabel() }}</small>
        </span>
        <button class="btn ghost sm" (click)="logout()" title="Sair">Sair</button>
      </div>
    </header>

    @if (rt.state() === 'reconectando' || rt.state() === 'desconectado') {
      <div class="offline">
        Sem conexão em tempo real — tentando reconectar… Os pedidos continuam salvos no servidor.
      </div>
    }

    <main>
      <router-outlet />
    </main>
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-height: 100dvh; }
    .top {
      position: sticky; top: 0; z-index: 20;
      display: flex; align-items: center; gap: 16px;
      padding: 8px 16px;
      background: linear-gradient(90deg, var(--sea-900), var(--sea-700));
      color: #fff;
      box-shadow: 0 2px 10px rgba(0,0,0,.15);
    }
    .brand { display: flex; align-items: center; gap: 10px; color: #fff; text-decoration: none; min-width: 0; }
    .brand-text { display: flex; flex-direction: column; line-height: 1.1; min-width: 0; }
    .brand-text strong { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .brand-text small { color: var(--sun-500); font-weight: 600; font-size: .72rem; letter-spacing: .04em; text-transform: uppercase; }
    .nav { display: flex; gap: 4px; margin-left: 8px; }
    .nav a {
      color: rgba(255,255,255,.8); text-decoration: none; font-weight: 600;
      padding: 8px 12px; border-radius: 9px; display: flex; gap: 6px; align-items: center;
    }
    .nav a:hover { background: rgba(255,255,255,.08); color: #fff; }
    .nav a.active { background: rgba(255,255,255,.16); color: #fff; }
    .right { margin-left: auto; display: flex; align-items: center; gap: 12px; }
    .right .btn { color: #fff; }
    .right .btn:hover { background: rgba(255,255,255,.12); }
    .who { display: flex; flex-direction: column; line-height: 1.1; text-align: right; font-weight: 600; }
    .who small { color: rgba(255,255,255,.65); font-weight: 500; }
    .conn { white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; font-size: .8rem; color: rgba(255,255,255,.8); }
    .conn i { width: 10px; height: 10px; border-radius: 50%; background: #9e9e9e; display: inline-block; }
    .conn.conectado i { background: #4ade80; box-shadow: 0 0 0 3px rgba(74,222,128,.25); }
    .conn.conectando i, .conn.reconectando i { background: var(--sun-500); animation: pulse 1s infinite; }
    .conn.desconectado i { background: #f87171; }
    @keyframes pulse { 50% { opacity: .35; } }
    .offline { background: var(--sun-100); color: #7a4f00; text-align: center; padding: 6px 12px; font-weight: 600; font-size: .9rem; }
    main { flex: 1; }
    @media (max-width: 1000px) {
      .top { gap: 8px; padding: 8px 12px; flex-wrap: wrap; }
      .brand-text strong { max-width: 52vw; }
      .brand-text small { display: none; }
      .nav { order: 3; width: 100%; margin: 0; justify-content: space-between; }
      .nav a { flex: 1; justify-content: center; padding: 6px; font-size: .85rem; }
    }
  `,
})
export class Shell implements OnInit, OnDestroy {
  protected auth = inject(AuthService);
  protected rt = inject(RealtimeService);
  protected settings = inject(SettingsStore);

  protected nav = computed(() => {
    const role = this.auth.user()?.role;
    return role ? NAV.filter((n) => n.roles.includes(role)) : [];
  });
  protected roleLabel = computed(() => {
    const r = this.auth.user()?.role;
    return r ? ROLE_LABEL[r] : '';
  });
  protected connLabel = computed(
    () => ({ conectado: 'Ao vivo', conectando: 'Conectando', reconectando: 'Reconectando', desconectado: 'Offline' })[this.rt.state()],
  );
  protected connTitle = computed(() =>
    this.rt.state() === 'conectado' ? 'Recebendo atualizações em tempo real' : 'Sem tempo real no momento',
  );

  ngOnInit() {
    this.rt.start();
  }

  ngOnDestroy() {
    this.rt.stop();
  }

  logout() {
    this.rt.stop();
    this.auth.logout();
  }
}
