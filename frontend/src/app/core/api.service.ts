import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  Category,
  CreateOrder,
  Indicators,
  OpenTable,
  Order,
  OrderStatus,
  Paged,
  Payment,
  PaymentMethod,
  Product,
  Settings,
  User,
  UserRole,
} from './models';

type Query = Record<string, string | number | boolean | null | undefined>;

function params(q: Query): HttpParams {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(q)) if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
  return p;
}

/** Acesso à API REST. Todos os métodos retornam Promise para uso direto com signals. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  private get<T>(url: string, q: Query = {}) {
    return firstValueFrom(this.http.get<T>(url, { params: params(q) }));
  }
  private post<T>(url: string, body: unknown) {
    return firstValueFrom(this.http.post<T>(url, body));
  }
  private put<T>(url: string, body: unknown) {
    return firstValueFrom(this.http.put<T>(url, body));
  }
  private patch<T>(url: string, body: unknown) {
    return firstValueFrom(this.http.patch<T>(url, body));
  }
  private delete<T>(url: string) {
    return firstValueFrom(this.http.delete<T>(url));
  }

  // Configurações
  settings = () => this.get<Settings>('/api/settings');
  saveSettings = (s: Settings) => this.put<Settings>('/api/settings', s);

  // Cardápio
  categories = () => this.get<Category[]>('/api/categories');
  createCategory = (c: { name: string; sortOrder: number }) => this.post<Category>('/api/categories', c);
  updateCategory = (id: number, c: { name: string; sortOrder: number }) => this.put<Category>(`/api/categories/${id}`, c);
  deleteCategory = (id: number) => this.delete<void>(`/api/categories/${id}`);

  products = (includeInactive = false) => this.get<Product[]>('/api/products', { includeInactive });
  createProduct = (p: ProductInput) => this.post<Product>('/api/products', p);
  updateProduct = (id: number, p: ProductInput) => this.put<Product>(`/api/products/${id}`, p);
  deleteProduct = (id: number) => this.delete<{ deactivated?: boolean; message?: string } | null>(`/api/products/${id}`);

  // Pedidos
  activeOrders = (mine = false) => this.get<Order[]>('/api/orders/active', { mine });
  history = (q: { from?: string; to?: string; status?: OrderStatus | ''; table?: number | null; page?: number; pageSize?: number }) =>
    this.get<Paged<Order>>('/api/orders', q);
  createOrder = (o: CreateOrder) => this.post<Order>('/api/orders', o);
  setStatus = (id: number, status: OrderStatus) => this.patch<Order>(`/api/orders/${id}/status`, { status });

  // Caixa
  openTables = () => this.get<OpenTable[]>('/api/cashier/tables');
  pay = (tableNumber: number, method: PaymentMethod, includeServiceFee: boolean) =>
    this.post<Payment>('/api/cashier/payments', { tableNumber, method, includeServiceFee });
  payments = (from?: string) => this.get<Payment[]>('/api/cashier/payments', { from });

  // Gestor
  indicators = (from: string, to: string) => this.get<Indicators>('/api/reports/indicators', { from, to });
  users = () => this.get<User[]>('/api/users');
  createUser = (u: UserInput) => this.post<User>('/api/users', u);
  updateUser = (id: number, u: UserInput) => this.put<User>(`/api/users/${id}`, u);
}

export interface ProductInput {
  name: string;
  description: string | null;
  price: number;
  categoryId: number;
  active: boolean;
}

export interface UserInput {
  name: string;
  username: string;
  password: string | null;
  role: UserRole;
  active: boolean;
}
