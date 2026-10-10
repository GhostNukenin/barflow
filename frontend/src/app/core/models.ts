export type UserRole = 'Garcom' | 'Cozinha' | 'Caixa' | 'Gestor';
export type OrderStatus = 'Pendente' | 'EmPreparo' | 'Pronto' | 'Entregue' | 'Cancelado';
export type PaymentMethod = 'Dinheiro' | 'Pix' | 'Debito' | 'Credito';

export interface User {
  id: number;
  name: string;
  username: string;
  role: UserRole;
  active: boolean;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface Category {
  id: number;
  name: string;
  sortOrder: number;
  productCount: number;
}

export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  categoryId: number;
  categoryName: string;
  active: boolean;
}

export interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  categoryName: string;
  unitPrice: number;
  quantity: number;
  notes: string | null;
}

export interface Order {
  id: number;
  tableNumber: number;
  waiterId: number;
  waiterName: string;
  status: OrderStatus;
  notes: string | null;
  startedAt: string | null;
  createdAt: string;
  kitchenReceivedAt: string | null;
  preparationStartedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  canceledAt: string | null;
  paymentId: number | null;
  total: number;
  items: OrderItem[];
}

export interface CreateOrder {
  tableNumber: number;
  notes: string | null;
  startedAt: string | null;
  items: { productId: number; quantity: number; notes: string | null }[];
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OpenTable {
  tableNumber: number;
  orderCount: number;
  subtotal: number;
  openedAt: string;
  allDelivered: boolean;
  orders: Order[];
}

export interface Payment {
  id: number;
  tableNumber: number;
  amount: number;
  serviceFee: number;
  method: PaymentMethod;
  cashierName: string;
  createdAt: string;
  orderCount: number;
}

export interface Settings {
  barName: string;
  tableCount: number;
  serviceFeePercent: number;
  baselineSeconds: number;
}

export interface Indicators {
  from: string;
  to: string;
  totalOrders: number;
  canceledOrders: number;
  deliveredOrders: number;
  revenue: number;
  averageTicket: number;
  avgToKitchenSeconds: number | null;
  avgComposeSeconds: number | null;
  avgQueueSeconds: number | null;
  avgPrepSeconds: number | null;
  avgPickupSeconds: number | null;
  avgTotalSeconds: number | null;
  baselineSeconds: number;
  ordersByHour: { hour: number; orders: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  daily: { date: string; orders: number; avgToKitchenSeconds: number | null; revenue: number }[];
  waiters: { name: string; orders: number; revenue: number }[];
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  Pendente: 'Pendente',
  EmPreparo: 'Em preparo',
  Pronto: 'Pronto',
  Entregue: 'Entregue',
  Cancelado: 'Cancelado',
};

export const ROLE_LABEL: Record<UserRole, string> = {
  Garcom: 'Garçom',
  Cozinha: 'Cozinha',
  Caixa: 'Caixa',
  Gestor: 'Gestor',
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  Dinheiro: 'Dinheiro',
  Pix: 'Pix',
  Debito: 'Débito',
  Credito: 'Crédito',
};

/** Tela inicial de cada perfil. */
export const ROLE_HOME: Record<UserRole, string> = {
  Garcom: '/garcom',
  Cozinha: '/cozinha',
  Caixa: '/caixa',
  Gestor: '/gestor',
};
