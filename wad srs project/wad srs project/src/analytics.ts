import type { ApiOrder } from './services/api';

const KITCHEN_ALERT_THRESHOLD_MS = 20 * 60 * 1000;

function parseTimestamp(value: string | null): number | null {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value;
  const timestamp = new Date(normalized).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getCompletedKitchenDurations(orders: ApiOrder[]): number[] {
  return orders.flatMap((order) => {
    const startedAt = parseTimestamp(order.kitchenStartedAt);
    const completedAt = parseTimestamp(order.kitchenCompletedAt);
    if (startedAt === null || completedAt === null || completedAt <= startedAt) return [];
    return [(completedAt - startedAt) / 60_000];
  });
}

export function getAverageKitchenPrepMinutes(orders: ApiOrder[]): number | null {
  const durations = getCompletedKitchenDurations(orders);
  if (durations.length === 0) return null;
  return Math.round((durations.reduce((total, duration) => total + duration, 0) / durations.length) * 10) / 10;
}

export interface KitchenDelayAlert {
  orderId: number;
  orderRef: string;
  brandName: string;
  elapsedMinutes: number;
}

export function getKitchenDelayAlerts(
  orders: ApiOrder[],
  now: number = Date.now()
): KitchenDelayAlert[] {
  return orders.flatMap((order) => {
    if (order.status !== 'In Kitchen') return [];
    const startedAt = parseTimestamp(order.kitchenStartedAt);
    if (startedAt === null) return [];
    const elapsedMs = now - startedAt;
    if (elapsedMs <= KITCHEN_ALERT_THRESHOLD_MS) return [];
    return [{
      orderId: order.id,
      orderRef: order.orderRef,
      brandName: order.brandName,
      elapsedMinutes: Math.ceil(elapsedMs / 60_000),
    }];
  });
}
