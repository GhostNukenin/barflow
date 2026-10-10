import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'erro' | 'info' | 'pronto';
}

/** Avisos rápidos (toasts), som e vibração. */
@Injectable({ providedIn: 'root' })
export class UiService {
  readonly toasts = signal<Toast[]>([]);
  readonly soundEnabled = signal(false);
  private seq = 0;
  private audio: AudioContext | null = null;

  toast(text: string, kind: Toast['kind'] = 'ok', ms = 3500) {
    const id = ++this.seq;
    this.toasts.update((t) => [...t, { id, text, kind }]);
    setTimeout(() => this.dismiss(id), ms);
  }

  dismiss(id: number) {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }

  /** Navegadores só liberam áudio depois de um toque do usuário. */
  enableSound() {
    try {
      this.audio ??= new AudioContext();
      this.audio.resume();
      this.soundEnabled.set(true);
      this.beep('ok');
    } catch {
      this.soundEnabled.set(false);
    }
  }

  beep(kind: 'novo' | 'pronto' | 'ok' = 'novo') {
    const ctx = this.audio;
    if (!ctx || !this.soundEnabled()) return;
    const notes = kind === 'novo' ? [880, 1175, 880] : kind === 'pronto' ? [660, 880, 1320] : [990];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.18;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.17);
    });
  }

  vibrate(pattern: number | number[] = [120, 60, 120]) {
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* sem suporte */
    }
  }
}
