import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { apiError, duration, HoraPipe, MoneyPipe } from '../../core/format';
import { Category, Order, OrderStatus, Product, STATUS_LABEL } from '../../core/models';
import { RealtimeService } from '../../core/realtime.service';
import { AutofocusDirective } from '../../core/autofocus';
import { SettingsStore, upsertOrder } from '../../core/settings.store';
import { UiService } from '../../core/ui.service';

interface CartLine {
  product: Product;
  quantity: number;
  notes: string;
}

const STATUS_ORDER: Record<OrderStatus, number> = { Pronto: 0, EmPreparo: 1, Pendente: 2, Entregue: 3, Cancelado: 4 };

@Component({
  selector: 'app-garcom',
  imports: [FormsModule, MoneyPipe, HoraPipe, AutofocusDirective],
  templateUrl: './garcom.html',
  styleUrl: './garcom.scss',
})
export class GarcomPage implements OnInit {
  private api = inject(ApiService);
  private rt = inject(RealtimeService);
  private auth = inject(AuthService);
  private destroyRef = inject(DestroyRef);
  protected ui = inject(UiService);
  protected settings = inject(SettingsStore);
  protected STATUS_LABEL = STATUS_LABEL;

  tab = signal<'novo' | 'pedidos'>('novo');

  // ---------- Novo pedido ----------
  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  category = signal<number | null>(null);
  search = signal('');
  table = signal<number | null>(null);
  startedAt = signal<string | null>(null);
  cart = signal<CartLine[]>([]);
  generalNotes = '';
  cartOpen = signal(false);
  sending = signal(false);
  noteOpenFor = signal<number | null>(null);

  // ---------- Pedidos ----------
  orders = signal<Order[]>([]);
  onlyMine = signal(true);
  now = signal(Date.now());

  tables = computed(() => Array.from({ length: this.settings.settings().tableCount }, (_, i) => i + 1));

  /** Mesas com pedidos em andamento → número de pedidos. */
  busyTables = computed(() => {
    const map = new Map<number, number>();
    for (const o of this.orders())
      if (o.status !== 'Entregue' && o.status !== 'Cancelado') map.set(o.tableNumber, (map.get(o.tableNumber) ?? 0) + 1);
    return map;
  });

  visibleCategories = computed(() => {
    const used = new Set(this.products().map((p) => p.categoryId));
    return this.categories().filter((c) => used.has(c.id));
  });

  filteredProducts = computed(() => {
    const term = this.normalize(this.search());
    const cat = this.category();
    return this.products().filter(
      (p) => (term ? this.normalize(p.name + ' ' + (p.description ?? '')).includes(term) : cat === null || p.categoryId === cat),
    );
  });

  qtyById = computed(() => new Map(this.cart().map((l) => [l.product.id, l.quantity])));
  cartCount = computed(() => this.cart().reduce((s, l) => s + l.quantity, 0));
  cartTotal = computed(() => this.cart().reduce((s, l) => s + l.quantity * l.product.price, 0));

  myId = computed(() => this.auth.user()?.id ?? 0);

  visibleOrders = computed(() => {
    const mine = this.onlyMine();
    const me = this.myId();
    return this.orders()
      .filter((o) => !mine || o.waiterId === me)
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.createdAt.localeCompare(b.createdAt));
  });
  readyCount = computed(() => this.orders().filter((o) => o.status === 'Pronto' && o.waiterId === this.myId()).length);

  ngOnInit() {
    this.loadMenu();
    this.loadOrders();

    const timer = setInterval(() => this.now.set(Date.now()), 15000);
    this.destroyRef.onDestroy(() => clearInterval(timer));

    this.rt.orderCreated$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((o) => this.orders.update((l) => upsertOrder(l, o)));
    this.rt.orderUpdated$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((o) => this.onOrderUpdated(o));
    this.rt.menuChanged$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadMenu());
    this.rt.reconnected$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadOrders());
  }

  async loadMenu() {
    try {
      const [products, categories] = await Promise.all([this.api.products(), this.api.categories()]);
      this.products.set(products);
      this.categories.set(categories);
      // Remove do carrinho o que saiu do cardápio.
      const ids = new Set(products.map((p) => p.id));
      this.cart.update((c) => c.filter((l) => ids.has(l.product.id)));
    } catch (e) {
      this.ui.toast(apiError(e, 'Erro ao carregar o cardápio.'), 'erro');
    }
  }

  async loadOrders() {
    try {
      this.orders.set(await this.api.activeOrders(false));
    } catch {
      /* o indicador de conexão já avisa */
    }
  }

  private onOrderUpdated(o: Order) {
    const prev = this.orders().find((x) => x.id === o.id);
    this.orders.update((l) => upsertOrder(l, o));
    if (o.status === 'Pronto' && prev?.status !== 'Pronto' && o.waiterId === this.myId()) {
      this.ui.toast(`✅ Pedido #${o.id} da mesa ${o.tableNumber} está pronto!`, 'pronto', 6000);
      this.ui.beep('pronto');
      this.ui.vibrate();
    }
  }

  // ---------- Fluxo do pedido ----------

  selectTable(n: number) {
    this.table.set(n);
    if (!this.startedAt()) this.startedAt.set(new Date().toISOString());
  }

  changeTable() {
    this.table.set(null);
  }

  add(p: Product) {
    if (!this.startedAt()) this.startedAt.set(new Date().toISOString());
    this.cart.update((c) => {
      const i = c.findIndex((l) => l.product.id === p.id);
      if (i < 0) return [...c, { product: p, quantity: 1, notes: '' }];
      const copy = c.slice();
      copy[i] = { ...copy[i], quantity: Math.min(99, copy[i].quantity + 1) };
      return copy;
    });
  }

  remove(p: Product) {
    this.cart.update((c) =>
      c.flatMap((l) => (l.product.id !== p.id ? [l] : l.quantity > 1 ? [{ ...l, quantity: l.quantity - 1 }] : [])),
    );
    if (this.cart().length === 0) this.cartOpen.set(false);
  }

  setNote(p: Product, notes: string) {
    this.cart.update((c) => c.map((l) => (l.product.id === p.id ? { ...l, notes } : l)));
  }

  clearOrder() {
    this.cart.set([]);
    this.generalNotes = '';
    this.table.set(null);
    this.startedAt.set(null);
    this.cartOpen.set(false);
    this.noteOpenFor.set(null);
  }

  async send() {
    const table = this.table();
    if (!table || this.cart().length === 0 || this.sending()) return;
    if (!this.ui.soundEnabled()) this.ui.enableSound();

    this.sending.set(true);
    try {
      const order = await this.api.createOrder({
        tableNumber: table,
        notes: this.generalNotes.trim() || null,
        startedAt: this.startedAt(),
        items: this.cart().map((l) => ({ productId: l.product.id, quantity: l.quantity, notes: l.notes.trim() || null })),
      });
      this.orders.update((l) => upsertOrder(l, order));
      this.ui.toast(`Pedido #${order.id} enviado para a cozinha · Mesa ${order.tableNumber}`);
      this.ui.vibrate(60);
      this.clearOrder();
    } catch (e) {
      this.ui.toast(apiError(e, 'Não foi possível enviar o pedido.'), 'erro', 6000);
    } finally {
      this.sending.set(false);
    }
  }

  // ---------- Ações nos pedidos ----------

  async setStatus(o: Order, status: OrderStatus) {
    try {
      const updated = await this.api.setStatus(o.id, status);
      this.orders.update((l) => upsertOrder(l, updated));
    } catch (e) {
      this.ui.toast(apiError(e), 'erro');
    }
  }

  async cancel(o: Order) {
    if (!confirm(`Cancelar o pedido #${o.id} da mesa ${o.tableNumber}?`)) return;
    await this.setStatus(o, 'Cancelado');
  }

  since(iso: string) {
    return duration((this.now() - new Date(iso).getTime()) / 1000);
  }

  summary(o: Order) {
    return o.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ');
  }

  private normalize(s: string) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }
}
