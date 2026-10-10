import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, ProductInput } from '../../core/api.service';
import { apiError, MoneyPipe } from '../../core/format';
import { Category, Product } from '../../core/models';
import { UiService } from '../../core/ui.service';

@Component({
  selector: 'app-produtos',
  imports: [FormsModule, MoneyPipe],
  template: `
    <div class="page-head">
      <div>
        <h1>Cardápio</h1>
        <span class="muted">{{ products().length }} produtos · {{ categories().length }} categorias</span>
      </div>
      <div class="row">
        <button class="btn" (click)="catOpen.set(true)">Categorias</button>
        <button class="btn primary" (click)="openNew()">+ Novo produto</button>
      </div>
    </div>

    <div class="row wrap" style="margin-bottom: 12px">
      <input class="input" style="max-width: 280px" type="search" placeholder="Buscar produto…" [ngModel]="search()" (ngModelChange)="search.set($event)" />
      <div class="chips grow">
        <button class="chip" [class.active]="filterCat() === null" (click)="filterCat.set(null)">Todas</button>
        @for (c of categories(); track c.id) {
          <button class="chip" [class.active]="filterCat() === c.id" (click)="filterCat.set(c.id)">{{ c.name }}</button>
        }
      </div>
    </div>

    <div class="card flat" style="padding: 0">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Produto</th><th>Categoria</th><th class="right">Preço</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            @for (p of filtered(); track p.id) {
              <tr class="clickable" [class.off]="!p.active" (click)="openEdit(p)">
                <td>
                  <strong>{{ p.name }}</strong>
                  @if (p.description) {
                    <div class="small faint">{{ p.description }}</div>
                  }
                </td>
                <td>{{ p.categoryName }}</td>
                <td class="right num">{{ p.price | money }}</td>
                <td>
                  <span class="pill" [class]="p.active ? 'st-Pronto' : 'st-Entregue'">{{ p.active ? 'Ativo' : 'Fora do cardápio' }}</span>
                </td>
                <td class="right"><button class="btn sm ghost">Editar</button></td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="empty">Nenhum produto.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Produto -->
    @if (editing(); as e) {
      <div class="overlay" (click)="editing.set(null)">
        <form class="modal stack" (click)="$event.stopPropagation()" (ngSubmit)="save()">
          <h2>{{ editId() ? 'Editar produto' : 'Novo produto' }}</h2>
          @if (error()) {
            <div class="error-box">{{ error() }}</div>
          }
          <label class="field">
            <span>Nome</span>
            <input class="input" name="name" [(ngModel)]="e.name" required maxlength="100" />
          </label>
          <label class="field">
            <span>Descrição (opcional)</span>
            <input class="input" name="description" [(ngModel)]="e.description" maxlength="300" />
          </label>
          <div class="form-grid">
            <label class="field">
              <span>Preço (R$)</span>
              <input class="input" name="price" type="number" step="0.01" min="0" [(ngModel)]="e.price" required />
            </label>
            <label class="field">
              <span>Categoria</span>
              <select class="input" name="categoryId" [(ngModel)]="e.categoryId" required>
                @for (c of categories(); track c.id) {
                  <option [ngValue]="c.id">{{ c.name }}</option>
                }
              </select>
            </label>
          </div>
          <label class="check"><input type="checkbox" name="active" [(ngModel)]="e.active" /> Disponível no cardápio</label>
          <div class="row between">
            @if (editId()) {
              <button type="button" class="btn ghost danger" (click)="remove()">Excluir</button>
            } @else {
              <span></span>
            }
            <div class="row">
              <button type="button" class="btn" (click)="editing.set(null)">Cancelar</button>
              <button type="submit" class="btn primary" [disabled]="saving()">Salvar</button>
            </div>
          </div>
        </form>
      </div>
    }

    <!-- Categorias -->
    @if (catOpen()) {
      <div class="overlay" (click)="catOpen.set(false)">
        <div class="modal stack" (click)="$event.stopPropagation()">
          <div class="row between">
            <h2>Categorias</h2>
            <button class="btn ghost sm" (click)="catOpen.set(false)">Fechar</button>
          </div>
          <p class="small muted" style="margin: 0">A ordem define a sequência no celular do garçom.</p>
          @for (c of categories(); track c.id) {
            <div class="row cat-row">
              <input class="input order" type="number" [value]="c.sortOrder" #o />
              <input class="input grow" [value]="c.name" #n maxlength="60" />
              <span class="small faint nowrap">{{ c.productCount }} itens</span>
              <button class="btn sm" (click)="saveCategory(c, n.value, +o.value)">Salvar</button>
              <button class="btn sm ghost danger" (click)="deleteCategory(c)" title="Excluir">✕</button>
            </div>
          }
          <div class="divider"></div>
          <form class="row" (ngSubmit)="addCategory()">
            <input class="input grow" name="newCat" placeholder="Nova categoria" [(ngModel)]="newCat" maxlength="60" />
            <button class="btn primary" type="submit" [disabled]="!newCat.trim()">Adicionar</button>
          </form>
        </div>
      </div>
    }
  `,
  styles: `
    tr.off td { opacity: .55; }
    .cat-row .order { width: 70px; flex: none; }
  `,
})
export class ProdutosPage implements OnInit {
  private api = inject(ApiService);
  private ui = inject(UiService);

  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  search = signal('');
  filterCat = signal<number | null>(null);

  editing = signal<ProductInput | null>(null);
  editId = signal<number | null>(null);
  saving = signal(false);
  error = signal('');

  catOpen = signal(false);
  newCat = '';

  filtered = computed(() => {
    const term = this.search().toLowerCase().trim();
    const cat = this.filterCat();
    return this.products().filter((p) => (cat === null || p.categoryId === cat) && (!term || p.name.toLowerCase().includes(term)));
  });

  ngOnInit() {
    this.load();
  }

  async load() {
    try {
      const [p, c] = await Promise.all([this.api.products(true), this.api.categories()]);
      this.products.set(p);
      this.categories.set(c);
    } catch (e) {
      this.ui.toast(apiError(e), 'erro');
    }
  }

  openNew() {
    this.error.set('');
    this.editId.set(null);
    this.editing.set({ name: '', description: '', price: 0, categoryId: this.filterCat() ?? this.categories()[0]?.id ?? 0, active: true });
  }

  openEdit(p: Product) {
    this.error.set('');
    this.editId.set(p.id);
    this.editing.set({ name: p.name, description: p.description ?? '', price: p.price, categoryId: p.categoryId, active: p.active });
  }

  async save() {
    const e = this.editing();
    if (!e) return;
    if (!e.name.trim()) return this.error.set('Informe o nome.');
    if (!e.categoryId) return this.error.set('Escolha a categoria (crie uma em "Categorias").');
    this.saving.set(true);
    try {
      const id = this.editId();
      const body = { ...e, price: Number(e.price) || 0 };
      if (id) await this.api.updateProduct(id, body);
      else await this.api.createProduct(body);
      this.ui.toast('Produto salvo');
      this.editing.set(null);
      await this.load();
    } catch (err) {
      this.error.set(apiError(err));
    } finally {
      this.saving.set(false);
    }
  }

  async remove() {
    const id = this.editId();
    if (!id || !confirm('Excluir este produto?')) return;
    try {
      const res = await this.api.deleteProduct(id);
      this.ui.toast(res?.message ?? 'Produto excluído', 'info', 5000);
      this.editing.set(null);
      await this.load();
    } catch (e) {
      this.error.set(apiError(e));
    }
  }

  async addCategory() {
    const name = this.newCat.trim();
    if (!name) return;
    try {
      const max = Math.max(0, ...this.categories().map((c) => c.sortOrder));
      await this.api.createCategory({ name, sortOrder: max + 1 });
      this.newCat = '';
      await this.load();
    } catch (e) {
      this.ui.toast(apiError(e), 'erro');
    }
  }

  async saveCategory(c: Category, name: string, sortOrder: number) {
    try {
      await this.api.updateCategory(c.id, { name: name.trim(), sortOrder: sortOrder || 0 });
      this.ui.toast('Categoria salva');
      await this.load();
    } catch (e) {
      this.ui.toast(apiError(e), 'erro');
    }
  }

  async deleteCategory(c: Category) {
    if (!confirm(`Excluir a categoria "${c.name}"?`)) return;
    try {
      await this.api.deleteCategory(c.id);
      await this.load();
    } catch (e) {
      this.ui.toast(apiError(e), 'erro', 5000);
    }
  }
}
