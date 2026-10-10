import { inject, Injectable, signal } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { Order, Settings } from './models';

export type ConnectionState = 'conectado' | 'conectando' | 'reconectando' | 'desconectado';

/** Conexão SignalR com o servidor. Um único hub para todas as telas. */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private auth = inject(AuthService);
  private hub: HubConnection | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  readonly state = signal<ConnectionState>('desconectado');

  readonly orderCreated$ = new Subject<Order>();
  readonly orderUpdated$ = new Subject<Order>();
  readonly menuChanged$ = new Subject<void>();
  readonly settingsChanged$ = new Subject<Settings>();
  /** Disparado após (re)conectar: as telas recarregam o estado para não perder eventos. */
  readonly reconnected$ = new Subject<void>();

  async start() {
    if (this.hub && this.hub.state !== HubConnectionState.Disconnected) return;

    this.hub = new HubConnectionBuilder()
      .withUrl('/hubs/orders', { accessTokenFactory: () => this.auth.token() ?? '' })
      // Tenta reconectar para sempre: a cozinha não pode ficar "surda" se o Wi-Fi oscilar.
      .withAutomaticReconnect({ nextRetryDelayInMilliseconds: (ctx) => Math.min(1000 * 2 ** ctx.previousRetryCount, 10000) })
      .configureLogging(LogLevel.Warning)
      .build();

    this.hub.on('OrderCreated', (o: Order) => this.orderCreated$.next(o));
    this.hub.on('OrderUpdated', (o: Order) => this.orderUpdated$.next(o));
    this.hub.on('MenuChanged', () => this.menuChanged$.next());
    this.hub.on('SettingsChanged', (s: Settings) => this.settingsChanged$.next(s));

    this.hub.onreconnecting(() => this.state.set('reconectando'));
    this.hub.onreconnected(() => {
      this.state.set('conectado');
      this.reconnected$.next();
    });
    this.hub.onclose(() => {
      this.state.set('desconectado');
      this.scheduleRetry();
    });

    await this.connect();
  }

  async stop() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const hub = this.hub;
    this.hub = null;
    this.state.set('desconectado');
    if (hub) await hub.stop().catch(() => undefined);
  }

  /** Cozinha confirma que os pedidos apareceram na tela (grava o horário de chegada). */
  async acknowledge(orderIds: number[]) {
    if (!orderIds.length || this.hub?.state !== HubConnectionState.Connected) return;
    try {
      await this.hub.invoke('AcknowledgeOrders', orderIds);
    } catch (e) {
      console.warn('Falha ao confirmar recebimento', e);
    }
  }

  private async connect() {
    if (!this.hub || !this.auth.token()) return;
    this.state.set('conectando');
    try {
      await this.hub.start();
      this.state.set('conectado');
      this.reconnected$.next();
    } catch {
      this.state.set('desconectado');
      this.scheduleRetry();
    }
  }

  private scheduleRetry() {
    if (!this.hub || this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.hub?.state === HubConnectionState.Disconnected) this.connect();
    }, 5000);
  }
}
