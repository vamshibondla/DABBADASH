export type OrderStatus =
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'dispatched'
  | 'delivered'
  | 'cancelled';

export type NavPage =
  | 'overview'
  | 'all-orders'
  | 'kitchen-board'
  | 'rider-dispatch'
  | 'delivery-batching'
  | 'live-map'
  | 'customer-tracking'
  | 'analytics';

export interface Order {
  apiId?: number;
  brandId?: number;
  id: string;
  customer: string;
  phone: string;
  brand: string;
  items: string[];
  total: number;
  status: OrderStatus;
  time: string;
  prepTime: number;
  rider?: string;
  address: string;
  area: string;
}

export interface Rider {
  apiId?: number;
  id: string;
  name: string;
  phone: string;
  status: 'available' | 'on-delivery' | 'offline';
  currentOrder?: string;
  deliveries: number;
  activeOrders?: number;
  maxActiveOrders?: number;
  rating: number;
  area: string;
  vehicle: 'bike' | 'bicycle' | 'scooter';
}

export interface BrandStat {
  name: string;
  orders: number;
  revenue: number;
  color: string;
}
