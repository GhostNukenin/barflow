import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, UserInput } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { apiError } from '../../core/format';
import { ROLE_LABEL, User, UserRole } from '../../core/models';
import { UiService } from '../../core/ui.service';

@Component({
  selector: 'app-usuarios',
  imports: [FormsModule],
  template: `
    <div class="page-head">
      <div>
        <h1>Usuários</h1>
        <span class="muted">Cada perfil vê apenas as telas da sua função</span>
      </div>
      <button class="btn primary" (click)="openNew()">+ Novo usuário</button>
    </div>

    <div class="card flat" style="padding: 0">
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Nome</th><th>Login</th><th>Perfil</th><th>Status</th><th></th></tr></thead>
          <tbody>
            @for (u of users(); track u.id) {
              <tr class="clickable" (click)="openEdit(u)">
                <td><strong>{{ u.name }}</strong></td>
                <td class="muted">{{ u.username }}</td>
                <td>{{ ROLE_LABEL[u.role] }}</td>
                <td><span class="pill" [class]="u.active ? 'st-Pronto' : 'st-Entregue'">{{ u.active ? 'Ativo' : 'Inativo' }}</span></td>
                <td class="right"><button class="btn sm ghost">Editar</button></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <div class="card flat roles">
      <div><strong>Garçom</strong><span>Registra pedidos, acompanha o andamento e marca como entregue.</span></div>
      <div><strong>Cozinha</strong><span>Vê os pedidos novos e marca em preparo e pronto.</span></div>
      <div><strong>Caixa</strong><span>Confere as contas das mesas e registra pagamentos.</span></div>
      <div><strong>Gestor</strong><span>Acessa tudo: cardápio, histórico, indicadores e usuários.</span></div>
    </div>

    @if (editing(); as e) {
      <div class="overlay" (click)="editing.set(null)">
        <form class="modal stack" (click)="$event.stopPropagation()" (ngSubmit)="save()">
          <h2>{{ editId() ? 'Editar usuário' : 'Novo usuário' }}</h2>
          @if (error()) {
            <div class="error-box">{{ error() }}</div>
          }
          <label class="field"><span>Nome</span><input class="input" name="name" [(ngModel)]="e.name" required maxlength="100" /></label>
          <div class="form-grid">
            <label class="field">
              <span>Login</span>
              <input class="input" name="username" [(ngModel)]="e.username" required maxlength="50" autocapitalize="none" autocomplete="off" />
            </label>
            <label class="field">
              <span>Perfil</span>
              <select class="input" name="role" [(ngModel)]="e.role">
                @for (r of roles; track r) {
                  <option [value]="r">{{ ROLE_LABEL[r] }}</option>
                }
              </select>
            </label>
          </div>
          <label class="field">
            <span>{{ editId() ? 'Nova senha (deixe em branco para manter)' : 'Senha' }}</span>
            <input class="input" name="password" type="password" [(ngModel)]="e.password" autocomplete="new-password" />
          </label>
          <label class="check"><input type="checkbox" name="active" [(ngModel)]="e.active" /> Usuário ativo</label>
          <div class="row" style="justify-content: flex-end">
            <button type="button" class="btn" (click)="editing.set(null)">Cancelar</button>
            <button type="submit" class="btn primary" [disabled]="saving()">Salvar</button>
          </div>
        </form>
      </div>
    }
  `,
  styles: `
    .roles { margin-top: 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
    .roles div { display: flex; flex-direction: column; gap: 2px; font-size: .9rem; }
    .roles span { color: var(--text-2); }
  `,
})
export class UsuariosPage implements OnInit {
  private api = inject(ApiService);
  private ui = inject(UiService);
  private auth = inject(AuthService);
  protected ROLE_LABEL = ROLE_LABEL;
  protected roles: UserRole[] = ['Garcom', 'Cozinha', 'Caixa', 'Gestor'];

  users = signal<User[]>([]);
  editing = signal<UserInput | null>(null);
  editId = signal<number | null>(null);
  saving = signal(false);
  error = signal('');

  ngOnInit() {
    this.load();
  }

  async load() {
    try {
      this.users.set(await this.api.users());
    } catch (e) {
      this.ui.toast(apiError(e), 'erro');
    }
  }

  openNew() {
    this.error.set('');
    this.editId.set(null);
    this.editing.set({ name: '', username: '', password: '', role: 'Garcom', active: true });
  }

  openEdit(u: User) {
    this.error.set('');
    this.editId.set(u.id);
    this.editing.set({ name: u.name, username: u.username, password: '', role: u.role, active: u.active });
  }

  async save() {
    const e = this.editing();
    if (!e) return;
    this.saving.set(true);
    try {
      const id = this.editId();
      const body = { ...e, password: e.password?.trim() || null };
      if (id) await this.api.updateUser(id, body);
      else await this.api.createUser(body);
      this.ui.toast('Usuário salvo');
      this.editing.set(null);
      await this.load();
      if (id === this.auth.user()?.id) this.ui.toast('Suas alterações valem a partir do próximo login.', 'info');
    } catch (err) {
      this.error.set(apiError(err));
    } finally {
      this.saving.set(false);
    }
  }
}
