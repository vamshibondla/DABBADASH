const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace(
  /\/+$/,
  ''
);

interface ApiEnvelope<T> {
  data: T;
}

interface ApiErrorResponse {
  error?: {
    code?: string;
    message?: string;
  };
}

export class ApiUnavailableError extends Error {}

export interface ApiHealth {
  status: 'ok';
  database: 'connected';
  demoData: boolean;
}

export type ApiOrderStatus =
  | 'Received'
  | 'In Kitchen'
  | 'Packed'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled';

export interface ApiBrand {
  id: number;
  name: string;
  cuisineType: string;
  color: string;
  isActive: boolean;
  createdAt: string;
}

export interface ApiOrderItem {
  id: number;
  menuItemId: number;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  specialInstructions: string;
}

export interface ApiOrder {
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
  status: ApiOrderStatus;
  totalAmount: number;
  prepTimeMinutes: number;
  items: ApiOrderItem[];
  placedAt: string;
  updatedAt: string;
}

export interface ApiCourier {
  id: number;
  name: string;
  phone: string;
  vehicleType: 'bike' | 'bicycle' | 'scooter';
  status: 'available' | 'on-delivery' | 'offline';
  currentZoneId: number | null;
  currentZoneName: string | null;
  deliveriesToday: number;
  activeOrders: number;
  maxActiveOrders: number;
  rating: number;
  earningsToday: number;
}

export interface ApiCourierRecommendation extends ApiCourier {
  sameZone: boolean;
}

export interface ApiCourierAssignment {
  order: ApiOrder;
  courier: ApiCourier;
}

export interface ApiDeliveryZone {
  id: number;
  name: string;
  sector: string;
  areaCoverage: string;
  baseDeliveryFee: number;
  activeOrders: number;
  assignedCouriers: number;
}

export type ApiDeliveryBatchStatus =
  | 'pending'
  | 'assigned'
  | 'in-progress'
  | 'completed'
  | 'cancelled';

export interface ApiBatchCourierRecommendation extends ApiCourierRecommendation {
  projectedActiveOrders: number;
}

export interface ApiDeliveryBatch {
  id: number;
  batchRef: string;
  deliveryZoneId: number | null;
  deliveryZoneName: string | null;
  courierId: number | null;
  courierName: string | null;
  status: ApiDeliveryBatchStatus;
  distanceKm: number;
  distanceSource: 'actual' | 'simulated';
  orderCount: number;
  orders: ApiOrder[];
  courier: ApiCourier | null;
  recommendedCouriers: ApiBatchCourierRecommendation[];
  createdAt: string;
  updatedAt: string;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  allowPlainResponse = false
): Promise<T> {
  let response: Response;
  try {
    const headers = new Headers(init?.headers);
    headers.set('Accept', 'application/json');
    if (init?.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new ApiUnavailableError(`Could not connect to the DabbaDash API at ${API_BASE_URL}.`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(`The API returned an invalid response (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    const errorBody = body as ApiErrorResponse;
    throw new Error(
      errorBody.error?.message || `The API request failed (HTTP ${response.status}).`
    );
  }

  if (typeof body !== 'object' || body === null) {
    throw new Error('The API response did not contain the expected data field.');
  }
  if (!('data' in body)) {
    if (allowPlainResponse) return body as T;
    throw new Error('The API response did not contain the expected data field.');
  }

  return (body as ApiEnvelope<T>).data;
}

export const api = {
  getHealth: () => request<ApiHealth>('/health', undefined, true),
  getBrands: () => request<ApiBrand[]>('/brands'),
  getOrders: () => request<ApiOrder[]>('/orders'),
  getCouriers: () => request<ApiCourier[]>('/couriers'),
  getDeliveryZones: () => request<ApiDeliveryZone[]>('/zones'),
  getDeliveryBatches: () => request<ApiDeliveryBatch[]>('/batches'),
  generateDeliveryBatches: () =>
    request<ApiDeliveryBatch[]>('/batches/generate', { method: 'POST' }),
  assignBatchCourier: (batchId: number, courierId: number) =>
    request<ApiDeliveryBatch>(`/batches/${batchId}/assign-courier`, {
      method: 'PATCH',
      body: JSON.stringify({ courierId }),
    }),
  updateDeliveryBatchStatus: (batchId: number, status: ApiDeliveryBatchStatus) =>
    request<ApiDeliveryBatch>(`/batches/${batchId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  getRecommendedCouriers: (orderId: number) =>
    request<ApiCourierRecommendation[]>(`/orders/${orderId}/recommended-couriers`),
  assignCourier: (orderId: number, courierId: number) =>
    request<ApiCourierAssignment>(`/orders/${orderId}/assign-courier`, {
      method: 'PATCH',
      body: JSON.stringify({ courierId }),
    }),
  updateCourierStatus: (
    courierId: number,
    status: ApiCourier['status']
  ) =>
    request<ApiCourier>(`/couriers/${courierId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  updateOrderStatus: (id: number, status: Exclude<ApiOrderStatus, 'Cancelled'>) =>
    request<ApiOrder>(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};
