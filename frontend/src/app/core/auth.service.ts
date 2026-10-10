import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { LoginResponse, ROLE_HOME, User, UserRole } from './models';

const TOKEN_KEY = 'barflow.token';
const USER_KEY = 'barflow.user';

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  readonly token = signal<string | null>(read<string>(TOKEN_KEY));
  readonly user = signal<User | null>(read<User>(USER_KEY));
  readonly isLoggedIn = computed(() => !!this.token() && !!this.user());

  constructor() {
    // Descarta token expirado ao abrir o app.
    const t = this.token();
    if (t && this.isExpired(t)) this.clear();
  }

  async login(username: string, password: string): Promise<User> {
    const res = await firstValueFrom(this.http.post<LoginResponse>('/api/auth/login', { username, password }));
    this.token.set(res.token);
    this.user.set(res.user);
    try {
      localStorage.setItem(TOKEN_KEY, JSON.stringify(res.token));
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    } catch {
      /* armazenamento indisponível: segue só em memória */
    }
    return res.user;
  }

  logout() {
    this.clear();
    this.router.navigateByUrl('/login');
  }

  hasRole(...roles: UserRole[]): boolean {
    const u = this.user();
    return !!u && roles.includes(u.role);
  }

  home(): string {
    const u = this.user();
    return u ? ROLE_HOME[u.role] : '/login';
  }

  private clear() {
    this.token.set(null);
    this.user.set(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      /* ignora */
    }
  }

  private isExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }
}
