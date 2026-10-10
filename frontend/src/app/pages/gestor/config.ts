import { ChangeDetectorRef, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { apiError } from '../../core/format';
import { SettingsStore } from '../../core/settings.store';
import { UiService } from '../../core/ui.service';

@Component({
  selector: 'app-config',
  imports: [FormsModule],
  template: `
    <div class="page-head">
      <div>
        <h1>Configurações</h1>
        <span class="muted">Dados gerais do bar</span>
      </div>
    </div>

    <form class="card stack" style="max-width: 640px" (ngSubmit)="save()">
      <label class="field">
        <span>Nome do bar</span>
        <input class="input" name="barName" [(ngModel)]="barName" required maxlength="100" />
      </label>
      <div class="form-grid">
        <label class="field">
          <span>Quantidade de mesas</span>
          <input class="input" type="number" name="tableCount" min="1" max="999" [(ngModel)]="tableCount" required />
        </label>
        <label class="field">
          <span>Taxa de serviço (%)</span>
          <input class="input" type="number" name="fee" min="0" max="30" step="0.5" [(ngModel)]="fee" />
        </label>
      </div>

      <div class="divider"></div>
      <div>
        <h3>Referência do processo antigo</h3>
        <p class="small muted">
          Quanto tempo, em média, o pedido anotado no papel levava para chegar à cozinha. É a base de comparação
          do indicador principal. Dica: cronometre alguns pedidos antes de implantar o sistema.
        </p>
      </div>
      <div class="row">
        <label class="field">
          <span>Minutos</span>
          <input class="input" type="number" name="bm" min="0" max="600" [(ngModel)]="baseMin" style="width: 110px" />
        </label>
        <label class="field">
          <span>Segundos</span>
          <input class="input" type="number" name="bs" min="0" max="59" [(ngModel)]="baseSec" style="width: 110px" />
        </label>
      </div>

      <div class="row" style="justify-content: flex-end">
        <button class="btn primary" type="submit" [disabled]="saving()">Salvar configurações</button>
      </div>
    </form>
  `,
})
export class ConfigPage implements OnInit {
  private api = inject(ApiService);
  private ui = inject(UiService);
  private store = inject(SettingsStore);
  private cdr = inject(ChangeDetectorRef);

  barName = '';
  tableCount = 20;
  fee = 10;
  baseMin = 3;
  baseSec = 0;
  saving = signal(false);

  async ngOnInit() {
    await this.store.load();
    const s = this.store.settings();
    this.barName = s.barName;
    this.tableCount = s.tableCount;
    this.fee = s.serviceFeePercent;
    this.baseMin = Math.floor(s.baselineSeconds / 60);
    this.baseSec = s.baselineSeconds % 60;
    this.cdr.markForCheck();
  }

  async save() {
    this.saving.set(true);
    try {
      const s = await this.api.saveSettings({
        barName: this.barName.trim(),
        tableCount: Number(this.tableCount),
        serviceFeePercent: Number(this.fee) || 0,
        baselineSeconds: (Number(this.baseMin) || 0) * 60 + (Number(this.baseSec) || 0),
      });
      this.store.settings.set(s);
      this.ui.toast('Configurações salvas');
    } catch (e) {
      this.ui.toast(apiError(e), 'erro');
    } finally {
      this.saving.set(false);
    }
  }
}
