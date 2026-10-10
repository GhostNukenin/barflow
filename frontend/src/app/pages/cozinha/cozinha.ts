import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../core/api.service';
import { apiError, elapsed, HoraPipe, minutesSince } from '../../core/format';
import { Order, OrderStatus } from '../../core/models';
import { RealtimeService } from '../../core/realtime.service';
import { upsertOrder } from '../../core/settings.store';
import { UiService } from '../../core/ui.service';

interface Column {
  status: OrderStatus;
  title: string;
  hint: string;
}

@Component({
  selector: 'app-cozinha',
  imports: [HoraPipe],
  templateUrl: './cozinha.html',
  styleUrl: './cozinha.scss',
})
export class CozinhaPage implements OnInit {
  private api = inject(ApiService);
  private rt = inject(RealtimeService);
  private destroyRef = inject(DestroyRef);
  protected ui = inject(UiService);

  orders = signal<Order[]>([]);
  now = signal(Date.now());
  fresh = signal<Set<number>>(new Set());
  busy = signal<Set<number>>(new Set());
  loading = signal(true);

  /** Alertas de tempo (minutos desde o envio). */
  readonly warnAfter = 10;
  readonly lateAfter = 20;

  columns: Column[] = [
    { status: 'Pendente', title: 'Novos', hint: 'Chegaram agora' },
    { status: 'EmPreparo', title: 'Em preparo', hint: 'Mão na massa' },
    { status: 'Pronto', title: 'Prontos', hint: 'Aguardando o garçom' },
  ];

  byStatus = computed(() => {
    const map: Record<string, Order[]> = { Pendente: [], EmPreparo: [], Pronto: [] };
    for (const o of this.orders()) map[o.status]?.push(o);
    map['Pronto'].sort((a, b) => (a.readyAt ?? '').localeCompare(b.readyAt ?? ''));
    return map;
  });

  ngOnInit() {
    this.load();

    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    this.destroyRef.onDestroy(() => clearInterval(timer));

    this.rt.orderCreated$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((o) => this.onCreated(o));
    this.rt.orderUpdated$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((o) => this.apply(o));
    this.rt.reconnected$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }

  async load() {
    try {
      const list = await this.api.activeOrders(false);
      this.orders.set(list.filter((o) => this.isKitchen(o.status)));
      // Tudo que está na tela e ainda não foi confirmado conta como "chegou na cozinha" agora.
      this.rt.acknowledge(this.orders().filter((o) => !o.kitchenReceivedAt).map((o) => o.id));
    } catch (e) {
      this.ui.toast(apiError(e, 'Erro ao carregar pedidos.'), 'erro');
    } finally {
      this.loading.set(false);
    }
  }

  private onCreated(o: Order) {
    this.apply(o);
    this.rt.acknowledge([o.id]);
    this.ui.beep('novo');
    this.fresh.update((s) => new Set(s).add(o.id));
    setTimeout(() => this.fresh.update((s) => { const n = new Set(s); n.delete(o.id); return n; }), 8000);
  }

  private apply(o: Order) {
    if (this.isKitchen(o.status)) this.orders.update((l) => upsertOrder(l, o));
    else this.orders.update((l) => l.filter((x) => x.id !== o.id));
  }

  async move(o: Order, status: OrderStatus) {
    this.busy.update((s) => new Set(s).add(o.id));
    try {
      this.apply(await this.api.setStatus(o.id, status));
    } catch (e) {
      this.ui.toast(apiError(e), 'erro');
    } finally {
      this.busy.update((s) => { const n = new Set(s); n.delete(o.id); return n; });
    }
  }

  timer(o: Order) {
    const from = o.status === 'Pronto' ? o.readyAt : o.createdAt;
    return elapsed(from, this.now());
  }

  level(o: Order): '' | 'warn' | 'late' {
    if (o.status === 'Pronto') return minutesSince(o.readyAt, this.now()) >= 5 ? 'warn' : '';
    const m = minutesSince(o.createdAt, this.now());
    return m >= this.lateAfter ? 'late' : m >= this.warnAfter ? 'warn' : '';
  }

  itemCount(o: Order) {
    return o.items.reduce((s, i) => s + i.quantity, 0);
  }

  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => undefined);
  }

  private isKitchen(s: OrderStatus) {
    return s === 'Pendente' || s === 'EmPreparo' || s === 'Pronto';
  }
}
