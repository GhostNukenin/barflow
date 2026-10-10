import { Pipe, PipeTransform } from '@angular/core';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function money(value: number | null | undefined): string {
  return brl.format(value ?? 0);
}

/** 75 → "1min 15s"; 3700 → "1h 01min". */
export function duration(seconds: number | null | undefined): string {
  if (seconds == null || !isFinite(seconds)) return '—';
  // Abaixo de 10s mostra décimos: o envio pelo sistema costuma levar menos de 1 segundo.
  if (seconds < 10) return `${Math.max(0, seconds).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}s`;
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`;
  return rest ? `${m}min ${String(rest).padStart(2, '0')}s` : `${m}min`;
}

/** Cronômetro "mm:ss" (ou "h:mm:ss") desde uma data ISO. */
export function elapsed(fromIso: string | null | undefined, now: number): string {
  if (!fromIso) return '';
  const s = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${String(m).padStart(2, '0')}:${sec}`;
}

export function minutesSince(fromIso: string | null | undefined, now: number): number {
  if (!fromIso) return 0;
  return (now - new Date(fromIso).getTime()) / 60000;
}

const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const timeSecFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(v: number | null | undefined) {
    return money(v);
  }
}

@Pipe({ name: 'duration' })
export class DurationPipe implements PipeTransform {
  transform(v: number | null | undefined) {
    return duration(v);
  }
}

@Pipe({ name: 'hora' })
export class HoraPipe implements PipeTransform {
  transform(v: string | null | undefined, mode: 'hm' | 'hms' | 'full' = 'hm') {
    if (!v) return '—';
    const d = new Date(v);
    return mode === 'full' ? dateTimeFmt.format(d) : mode === 'hms' ? timeSecFmt.format(d) : timeFmt.format(d);
  }
}

/** Data local no formato yyyy-mm-dd (para inputs type=date). */
export function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Converte yyyy-mm-dd (horário local, início do dia) para ISO UTC. */
export function startOfLocalDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toISOString();
}

export function apiError(err: unknown, fallback = 'Algo deu errado. Tente novamente.'): string {
  const e = err as { error?: { message?: string; title?: string; errors?: Record<string, string[]> }; status?: number };
  if (e?.status === 0) return 'Sem conexão com o servidor.';
  if (e?.error?.message) return e.error.message;
  if (e?.error?.errors) return Object.values(e.error.errors).flat()[0] ?? fallback;
  return e?.error?.title ?? fallback;
}
