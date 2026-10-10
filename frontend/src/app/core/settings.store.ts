import { inject, Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import { Settings } from './models';
import { RealtimeService } from './realtime.service';

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private api = inject(ApiService);
  readonly settings = signal<Settings>({ barName: 'Bahia Resenha & Bar', tableCount: 20, serviceFeePercent: 10, baselineSeconds: 180 });

  constructor() {
    inject(RealtimeService).settingsChanged$.subscribe((s) => this.settings.set(s));
    this.load();
  }

  async load() {
    try {
      this.settings.set(await this.api.settings());
    } catch {
      /* mantém o padrão */
    }
  }
}

/** Atualiza/insere um pedido numa lista, mantendo a ordem por criação. */
export function upsertOrder<T extends { id: number; createdAt: string }>(list: T[], order: T): T[] {
  const i = list.findIndex((o) => o.id === order.id);
  if (i >= 0) {
    const copy = list.slice();
    copy[i] = order;
    return copy;
  }
  return [...list, order].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
