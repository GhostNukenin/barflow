import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-gestor',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="page">
      <nav class="tabs" style="margin-bottom: 18px">
        <a routerLink="indicadores" routerLinkActive="active">📊 Indicadores</a>
        <a routerLink="produtos" routerLinkActive="active">🍤 Cardápio</a>
        <a routerLink="historico" routerLinkActive="active">🗂️ Histórico</a>
        <a routerLink="usuarios" routerLinkActive="active">👥 Usuários</a>
        <a routerLink="config" routerLinkActive="active">⚙️ Configurações</a>
      </nav>
      <router-outlet />
    </div>
  `,
})
export class GestorPage {}
