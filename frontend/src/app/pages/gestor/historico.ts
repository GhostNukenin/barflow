import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { apiError, duration, HoraPipe, isoDate, MoneyPipe, startOfLocalDay } from '../../core/format';
import { Order, OrderStatus, STATUS_LABEL } from '../../core/models';
import { UiService } from '../../core/ui.service';

@Component({
  selector: 'app-historico',
  imports: [FormsModule, MoneyPipe, HoraPipe],
  template: `
    <div class="page-head">
      <div>
        <h1>Histórico de pedidos</h1>
        <span class="muted">{{ total() }} pedidos encontrados</span>
      </div>
    </div>

    <form class="card flat filters" (ngSubmit)="search(1)">
      <label class="field"><span>De</span><input class="input" type="date" name="from" [(ngModel)]="from" /></label>
      <label class="field"><span>Até</span><input class="input" type="date" name="to" [(ngModel)]="to" /></label>
      <label class="field">
        <span>Status</span>
        <select class="input" name="status" [(ngModel)]="status">
          <option value="">Todos</option>
          @for (s of statuses; track s) {
            <option [value]="s">{{ STATUS_LABEL[s] }}</option>
          }
        </select>
      </label>
      <label class="field"><span>Mesa</span><input class="input" type="number" min="1" name="table" [(ngModel)]="table" placeholder="Todas" /></label>
      <button class="btn primary" type="submit">Filtrar</button>
    </form>

    <div class="card flat" style="padding: 0; margin-top: 12px">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>#</th><th>Data</th><th>Mesa</th><th class="hide-sm">Garçom</th><th>Status</th>
              <th class="right hide-sm">Até a cozinha</th><th class="right">Total</th>
            </tr>
          </thead>
          <tbody>
            @for (o of orders(); track o.id) {
              <tr class="clickable" (click)="toggle(o.id)">
                <td class="num faint">{{ o.id }}</td>
                <td class="num nowrap">{{ o.createdAt | hora: 'full' }}</td>
                <td>{{ o.tableNumber }}</td>
                <td class="hide-sm">{{ o.waiterName }}</td>
                <td><span class="pill" [class]="'st-' + o.status">{{ STATUS_LABEL[o.status] }}</span></td>
                <td class="right num hide-sm">{{ span(o.createdAt, o.kitchenReceivedAt) }}</td>
                <td class="right num">{{ o.total | money }}</td>
              </tr>
              @if (open() === o.id) {
                <tr class="detail">
                  <td colspan="7">
                    <div class="det">
                      <div>
                        <h4>Itens</h4>
                        @for (i of o.items; track i.id) {
                          <div class="small">
                            {{ i.quantity }}× {{ i.productName }} — {{ i.unitPrice * i.quantity | money }}
                            @if (i.notes) { <em class="faint">({{ i.notes }})</em> }
                          </div>
                        }
                        @if (o.notes) { <div class="small"><strong>Obs.:</strong> {{ o.notes }}</div> }
                      </div>
                      <div>
                        <h4>Linha do tempo</h4>
                        <div class="tl small">
                          @if (o.startedAt) { <span>Começou a montar</span><span class="num">{{ o.startedAt | hora: 'hms' }}</span> }
                          <span>Enviado pelo garçom</span><span class="num">{{ o.createdAt | hora: 'hms' }}</span>
                          <span>Chegou na cozinha</span><span class="num">{{ o.kitchenReceivedAt | hora: 'hms' }}</span>
                          <span>Início do preparo</span><span class="num">{{ o.preparationStartedAt | hora: 'hms' }}</span>
                          <span>Pronto</span><span class="num">{{ o.readyAt | hora: 'hms' }}</span>
                          <span>Entregue</span><span class="num">{{ o.deliveredAt | hora: 'hms' }}</span>
                          @if (o.canceledAt) { <span>Cancelado</span><span class="num">{{ o.canceledAt | hora: 'hms' }}</span> }
                          <span>Pago</span><span>{{ o.paymentId ? 'Sim' : 'Não' }}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              }
            } @empty {
              <tr><td colspan="7" class="empty">{{ loading() ? 'Carregando…' : 'Nenhum pedido no filtro.' }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (pages() > 1) {
      <div class="row" style="justify-content: center; margin-top: 12px">
        <button class="btn sm" [disabled]="page() <= 1" (click)="search(page() - 1)">← Anterior</button>
        <span class="muted small">Página {{ page() }} de {{ pages() }}</span>
        <button class="btn sm" [disabled]="page() >= pages()" (click)="search(page() + 1)">Próxima →</button>
      </div>
    }
  `,
  styles: `
    .filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; align-items: end; }
    tr.detail td { background: var(--surface-2); }
    .det { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 4px 0; }
    .det h4 { margin-bottom: 6px; }
    .tl { display: grid; grid-template-columns: auto auto; gap: 2px 16px; justify-content: start; }
    @media (max-width: 640px) { .det { grid-template-columns: 1fr; } }
  `,
})
export class HistoricoPage implements OnInit {
  private api = inject(ApiService);
  private ui = inject(UiService);
  protected STATUS_LABEL = STATUS_LABEL;
  protected statuses: OrderStatus[] = ['Pendente', 'EmPreparo', 'Pronto', 'Entregue', 'Cancelado'];

  from = isoDate(new Date(Date.now() - 6 * 86400000));
  to = isoDate(new Date());
  status: OrderStatus | '' = '';
  table: number | null = null;

  orders = signal<Order[]>([]);
  total = signal(0);
  page = signal(1);
  pageSize = 25;
  open = signal<number | null>(null);
  loading = signal(false);
  pages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));

  ngOnInit() {
    this.search(1);
  }

  async search(page: number) {
    this.loading.set(true);
    try {
      const end = new Date(startOfLocalDay(this.to));
      end.setDate(end.getDate() + 1);
      const res = await this.api.history({
        from: this.from ? startOfLocalDay(this.from) : undefined,
        to: this.to ? end.toISOString() : undefined,
        status: this.status,
        table: this.table || null,
        page,
        pageSize: this.pageSize,
      });
      this.orders.set(res.items);
      this.total.set(res.total);
      this.page.set(res.page);
    } catch (e) {
      this.ui.toast(apiError(e), 'erro');
    } finally {
      this.loading.set(false);
    }
  }

  toggle(id: number) {
    this.open.set(this.open() === id ? null : id);
  }

  span(a: string | null, b: string | null) {
    return a && b ? duration((new Date(b).getTime() - new Date(a).getTime()) / 1000) : '—';
  }
}
