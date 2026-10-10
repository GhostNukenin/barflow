import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { merge } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { ApiService } from '../../core/api.service';
import { apiError, HoraPipe, isoDate, MoneyPipe, startOfLocalDay } from '../../core/format';
import { OpenTable, PAYMENT_LABEL, Payment, PaymentMethod, STATUS_LABEL } from '../../core/models';
import { RealtimeService } from '../../core/realtime.service';
import { SettingsStore } from '../../core/settings.store';
import { UiService } from '../../core/ui.service';

interface Consolidated {
  name: string;
  unitPrice: number;
  quantity: number;
}

@Component({
  selector: 'app-caixa',
  imports: [MoneyPipe, HoraPipe],
  templateUrl: './caixa.html',
  styleUrl: './caixa.scss',
})
export class CaixaPage implements OnInit {
  private api = inject(ApiService);
  private rt = inject(RealtimeService);
  private destroyRef = inject(DestroyRef);
  private ui = inject(UiService);
  protected settings = inject(SettingsStore);
  protected STATUS_LABEL = STATUS_LABEL;
  protected PAYMENT_LABEL = PAYMENT_LABEL;
  protected methods: PaymentMethod[] = ['Pix', 'Credito', 'Debito', 'Dinheiro'];

  tables = signal<OpenTable[]>([]);
  payments = signal<Payment[]>([]);
  selected = signal<number | null>(null);
  includeFee = signal(true);
  method = signal<PaymentMethod>('Pix');
  paying = signal(false);
  showOrders = signal(false);
  now = signal(Date.now());

  current = computed(() => this.tables().find((t) => t.tableNumber === this.selected()) ?? null);

  /** Itens da mesa somados por produto e preço. */
  consolidated = computed<Consolidated[]>(() => {
    const t = this.current();
    if (!t) return [];
    const map = new Map<string, Consolidated>();
    for (const o of t.orders)
      for (const i of o.items) {
        const key = `${i.productName}|${i.unitPrice}`;
        const c = map.get(key) ?? { name: i.productName, unitPrice: i.unitPrice, quantity: 0 };
        c.quantity += i.quantity;
        map.set(key, c);
      }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  });

  fee = computed(() => {
    const t = this.current();
    return t && this.includeFee() ? Math.round(t.subtotal * this.settings.settings().serviceFeePercent) / 100 : 0;
  });
  total = computed(() => (this.current()?.subtotal ?? 0) + this.fee());

  dayTotal = computed(() => this.payments().reduce((s, p) => s + p.amount, 0));
  byMethod = computed(() => {
    const map = new Map<PaymentMethod, number>();
    for (const p of this.payments()) map.set(p.method, (map.get(p.method) ?? 0) + p.amount);
    return this.methods.filter((m) => map.has(m)).map((m) => ({ method: m, amount: map.get(m)! }));
  });

  ngOnInit() {
    this.load();
    const timer = setInterval(() => this.now.set(Date.now()), 30000);
    this.destroyRef.onDestroy(() => clearInterval(timer));

    merge(this.rt.orderCreated$, this.rt.orderUpdated$, this.rt.reconnected$)
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }

  async load() {
    try {
      const [tables, payments] = await Promise.all([this.api.openTables(), this.api.payments(startOfLocalDay(isoDate(new Date())))]);
      this.tables.set(tables);
      this.payments.set(payments);
      if (this.selected() !== null && !tables.some((t) => t.tableNumber === this.selected())) this.selected.set(null);
    } catch (e) {
      this.ui.toast(apiError(e, 'Erro ao carregar as mesas.'), 'erro');
    }
  }

  select(t: OpenTable) {
    this.selected.set(t.tableNumber);
    this.includeFee.set(true);
    this.showOrders.set(false);
  }

  async pay() {
    const t = this.current();
    if (!t || this.paying()) return;
    const pending = t.orders.filter((o) => o.status !== 'Entregue').length;
    const msg =
      `Fechar a conta da mesa ${t.tableNumber} no ${PAYMENT_LABEL[this.method()]}?` +
      (pending ? `\n\nAtenção: ${pending} pedido(s) ainda não foram entregues e serão marcados como entregues.` : '');
    if (!confirm(msg)) return;

    this.paying.set(true);
    try {
      const p = await this.api.pay(t.tableNumber, this.method(), this.includeFee());
      this.ui.toast(`Mesa ${p.tableNumber} paga · ${PAYMENT_LABEL[p.method]}`);
      this.selected.set(null);
      await this.load();
    } catch (e) {
      this.ui.toast(apiError(e, 'Não foi possível registrar o pagamento.'), 'erro');
    } finally {
      this.paying.set(false);
    }
  }

  openMinutes(t: OpenTable) {
    const m = Math.floor((this.now() - new Date(t.openedAt).getTime()) / 60000);
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
  }
}
