// ─── DB Row types (snake_case — what SQLite returns) ─────────────────────────

export const ORDER_STATUSES = [
  'Received',
  'In Kitchen',
  'Packed',
  'Out for Delivery',
  'Delivered',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type OrderResponseStatus = OrderStatus | 'Cancelled';

export interface BrandRow {
  id: number;
  name: string;
  cuisine_type: string;
  color: string;
  is_active: number;
  created_at: string;
}

export interface MenuItemRow {
  id: number;
  brand_id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  is_available: number;
  created_at: string;
}

export interface DeliveryZoneRow {
  id: number;
  name: string;
  sector: string;
  area_coverage: string;
  base_delivery_fee: number;
  created_at: string;
}

export interface CourierRow {
  id: number;
  name: string;
  phone: string;
  vehicle_type: string;
  status: string;
  current_zone_id: number | null;
  deliveries_today: number;
  max_active_orders: number;
  rating: number;
  earnings_today: number;
  created_at: string;
}

export interface OrderRow {
  id: number;
  order_ref: string;
  brand_id: number;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_zone_id: number | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  kitchen_started_at: string | null;
  kitchen_completed_at: string | null;
  courier_id: number | null;
  status: string;
  total_amount: number;
  prep_time_minutes: number;
  placed_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  id: number;
  order_id: number;
  menu_item_id: number;
  quantity: number;
  unit_price: number;
  special_instructions: string;
}

// ─── API Response types (camelCase — what the routes return) ─────────────────

export interface Brand {
  id: number;
  name: string;
  cuisineType: string;
  color: string;
  isActive: boolean;
  createdAt: string;
}

export interface MenuItem {
  id: number;
  brandId: number;
  brandName: string;
  name: string;
  description: string;
  price: number;
  category: string;
  isAvailable: boolean;
}

export interface DeliveryZone {
  id: number;
  name: string;
  sector: string;
  areaCoverage: string;
  baseDeliveryFee: number;
  activeOrders: number;
  assignedCouriers: number;
}

export interface Courier {
  id: number;
  name: string;
  phone: string;
  vehicleType: string;
  status: string;
  currentZoneId: number | null;
  currentZoneName: string | null;
  deliveriesToday: number;
  activeOrders: number;
  maxActiveOrders: number;
  rating: number;
  earningsToday: number;
}

export interface OrderItem {
  id: number;
  menuItemId: number;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  specialInstructions: string;
}

export interface Order {
  id: number;
  orderRef: string;
  brandId: number;
  brandName: string;
  brandColor: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryZoneId: number | null;
  deliveryZoneName: string | null;
  kitchenStartedAt: string | null;
  kitchenCompletedAt: string | null;
  courierId: number | null;
  courierName: string | null;
  status: OrderResponseStatus;
  totalAmount: number;
  prepTimeMinutes: number;
  items: OrderItem[];
  placedAt: string;
  updatedAt: string;
}

export interface CourierRecommendation extends Courier {
  sameZone: boolean;
}

export type DeliveryBatchStatus =
  | 'pending'
  | 'assigned'
  | 'in-progress'
  | 'completed'
  | 'cancelled';

export type DeliveryBatchDistanceSource = 'actual' | 'simulated';

export interface DeliveryBatchRow {
  id: number;
  batch_ref: string;
  delivery_zone_id: number | null;
  courier_id: number | null;
  status: DeliveryBatchStatus;
  distance_km: number;
  distance_source: DeliveryBatchDistanceSource;
  created_at: string;
  updated_at: string;
}

export interface BatchCourierRecommendation extends CourierRecommendation {
  projectedActiveOrders: number;
}

export interface DeliveryBatch {
  id: number;
  batchRef: string;
  deliveryZoneId: number | null;
  deliveryZoneName: string | null;
  courierId: number | null;
  courierName: string | null;
  status: DeliveryBatchStatus;
  distanceKm: number;
  distanceSource: DeliveryBatchDistanceSource;
  orderCount: number;
  orders: Order[];
  courier: Courier | null;
  recommendedCouriers: BatchCourierRecommendation[];
  createdAt: string;
  updatedAt: string;
}

export interface CourierAssignment {
  order: Order;
  courier: Courier;
}

export interface CreateOrderInput {
  brandId: number;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryZoneId?: number | null;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  courierId?: number | null;
  prepTimeMinutes?: number;
  items: Array<{
    menuItemId: number;
    quantity: number;
    specialInstructions?: string;
  }>;
}
