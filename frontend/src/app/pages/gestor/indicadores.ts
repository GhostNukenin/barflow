import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { merge } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { ApiService } from '../../core/api.service';
import { apiError, DurationPipe, isoDate, MoneyPipe, startOfLocalDay } from '../../core/format';
import { Indicators } from '../../core/models';
import { RealtimeService } from '../../core/realtime.service';
import { UiService } from '../../core/ui.service';

type Period = 'hoje' | '7d' | '30d';

@Component({
  selector: 'app-indicadores',
  imports: [MoneyPipe, DurationPipe, DatePipe],
  templateUrl: './indicadores.html',
  styleUrl: './indicadores.scss',
})
export class IndicadoresPage implements OnInit {
  private api = inject(ApiService);
  private ui = inject(UiService);
  private rt = inject(RealtimeService);
  private destroyRef = inject(DestroyRef);

  period = signal<Period>('hoje');
  data = signal<Indicators | null>(null);
  loading = signal(false);
  hover = signal<number | null>(null);

  /** Comparação com o processo antigo (papel). */
  comparison = computed(() => {
    const d = this.data();
    if (!d || d.avgToKitchenSeconds == null || !d.baselineSeconds) return null;
    const diff = d.baselineSeconds - d.avgToKitchenSeconds;
    return { diff, pct: Math.round((diff / d.baselineSeconds) * 100), faster: diff >= 0 };
  });

  /** Etapas do pedido, do toque no celular até a mesa. */
  stages = computed(() => {
    const d = this.data();
    if (!d) return [];
    const list = [
      { key: 'compose', label: 'Montagem do pedido', hint: 'garçom monta no celular', value: d.avgComposeSeconds },
      { key: 'kitchen', label: 'Envio até a cozinha', hint: 'indicador principal', value: d.avgToKitchenSeconds, main: true },
      { key: 'queue', label: 'Fila na cozinha', hint: 'até iniciar o preparo', value: d.avgQueueSeconds },
      { key: 'prep', label: 'Preparo', hint: 'até ficar pronto', value: d.avgPrepSeconds },
      { key: 'pickup', label: 'Retirada', hint: 'pronto → entregue', value: d.avgPickupSeconds },
    ];
    const max = Math.max(1, ...list.map((s) => s.value ?? 0));
    return list.map((s) => ({ ...s, pct: s.value == null ? 0 : Math.max(1.5, (s.value / max) * 100) }));
  });

  /** Pedidos por hora: completa as horas sem pedido entre a primeira e a última. */
  hours = computed(() => {
    const d = this.data();
    if (!d || d.ordersByHour.length === 0) return [];
    const map = new Map(d.ordersByHour.map((h) => [h.hour, h.orders]));
    const min = Math.min(...map.keys());
    const max = Math.max(...map.keys());
    const peak = Math.max(...map.values());
    return Array.from({ length: max - min + 1 }, (_, i) => {
      const hour = min + i;
      const orders = map.get(hour) ?? 0;
      return { hour, orders, pct: (orders / peak) * 100 };
    });
  });

  topMax = computed(() => Math.max(1, ...(this.data()?.topProducts.map((p) => p.quantity) ?? [1])));

  ngOnInit() {
    this.load();
    // Atualiza sozinho quando há movimento (útil deixar aberto no balcão).
    merge(this.rt.orderCreated$, this.rt.orderUpdated$)
      .pipe(debounceTime(3000), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load(true));
  }

  setPeriod(p: Period) {
    this.period.set(p);
    this.load();
  }

  async load(silent = false) {
    const today = new Date();
    const days = { hoje: 0, '7d': 6, '30d': 29 }[this.period()];
    const start = new Date(today);
    start.setDate(start.getDate() - days);
    const end = new Date(today);
    end.setDate(end.getDate() + 1);

    if (!silent) this.loading.set(true);
    try {
      this.data.set(await this.api.indicators(startOfLocalDay(isoDate(start)), startOfLocalDay(isoDate(end))));
    } catch (e) {
      if (!silent) this.ui.toast(apiError(e, 'Erro ao carregar indicadores.'), 'erro');
    } finally {
      this.loading.set(false);
    }
  }
}
