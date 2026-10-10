import { Routes } from '@angular/router';
import { authGuard, homeRedirect, roleGuard } from './core/http';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login').then((m) => m.LoginPage), title: 'Entrar · BarFlow' },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      {
        path: 'garcom',
        canActivate: [roleGuard('Garcom', 'Gestor')],
        loadComponent: () => import('./pages/garcom/garcom').then((m) => m.GarcomPage),
        title: 'Garçom · BarFlow',
      },
      {
        path: 'cozinha',
        canActivate: [roleGuard('Cozinha', 'Gestor')],
        loadComponent: () => import('./pages/cozinha/cozinha').then((m) => m.CozinhaPage),
        title: 'Cozinha · BarFlow',
      },
      {
        path: 'caixa',
        canActivate: [roleGuard('Caixa', 'Gestor')],
        loadComponent: () => import('./pages/caixa/caixa').then((m) => m.CaixaPage),
        title: 'Caixa · BarFlow',
      },
      {
        path: 'gestor',
        canActivate: [roleGuard('Gestor')],
        loadComponent: () => import('./pages/gestor/gestor').then((m) => m.GestorPage),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'indicadores' },
          { path: 'indicadores', loadComponent: () => import('./pages/gestor/indicadores').then((m) => m.IndicadoresPage), title: 'Indicadores · BarFlow' },
          { path: 'produtos', loadComponent: () => import('./pages/gestor/produtos').then((m) => m.ProdutosPage), title: 'Produtos · BarFlow' },
          { path: 'historico', loadComponent: () => import('./pages/gestor/historico').then((m) => m.HistoricoPage), title: 'Histórico · BarFlow' },
          { path: 'usuarios', loadComponent: () => import('./pages/gestor/usuarios').then((m) => m.UsuariosPage), title: 'Usuários · BarFlow' },
          { path: 'config', loadComponent: () => import('./pages/gestor/config').then((m) => m.ConfigPage), title: 'Configurações · BarFlow' },
        ],
      },
      { path: '', pathMatch: 'full', canActivate: [homeRedirect], children: [] },
    ],
  },
  { path: '**', redirectTo: '' },
];
