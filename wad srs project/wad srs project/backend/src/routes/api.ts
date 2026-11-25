import { randomUUID } from 'crypto';
import { Router } from 'express';
import type { Request } from 'express';
import { ApiError } from '../apiError';
import { getDb } from '../db/connection';
import type {
  BatchCourierRecommendation,
  Brand,
  BrandRow,
  CourierAssignment,
  Courier,
  CourierRecommendation,
  CreateOrderInput,
  DeliveryBatch,
  DeliveryBatchDistanceSource,
  DeliveryBatchRow,
  DeliveryBatchStatus,
  DeliveryZone,
  Order,
  OrderItem,
  OrderItemRow,
  OrderRow,
  OrderStatus,
} from '../types';
import { ORDER_STATUSES } from '../types';

const router = Router();

const statusToDatabase: Record<OrderStatus, string> = {
  Received: 'pending',
  'In Kitchen': 'preparing',
  Packed: 'ready',
  'Out for Delivery': 'dispatched',
  Delivered: 'delivered',
};

const nextDatabaseOrderStatus: Record<string, string> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'dispatched',
  dispatched: 'delivered',
};

const statusFromDatabase: Record<string, Order['status']> = {
  pending: 'Received',
  preparing: 'In Kitchen',
  ready: 'Packed',
  dispatched: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

interface OrderQueryRow extends OrderRow {
  brand_name: string;
  brand_color: string;
  delivery_zone_name: string | null;
  courier_name: string | null;
}

interface OrderItemQueryRow extends OrderItemRow {
  menu_item_name: string;
}

interface CourierQueryRow {
  id: number;
  name: string;
  phone: string;
  vehicle_type: string;
  status: string;
  current_zone_id: number | null;
  current_zone_name: string | null;
  deliveries_today: number;
  active_orders: number;
  max_active_orders: number;
  rating: number;
  earnings_today: number;
}

interface CreateOrderItem {
  menuItemId: number;
  quantity: number;
  specialInstructions: string;
}

interface ValidatedCreateOrder extends Omit<CreateOrderInput, 'items'> {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  items: CreateOrderItem[];
}

function parseId(value: string, field = 'id'): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new ApiError(400, 'INVALID_ID', `${field} must be a positive integer.`);
  }

  const id = Number(value);
  if (!Number.isSafeInteger(id)) {
    throw new ApiError(400, 'INVALID_ID', `${field} must be a positive integer.`);
  }
  return id;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePositiveInteger(value: unknown, field: string, max?: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || (max && value > max)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be a positive integer${max ? ` no greater than ${max}` : ''}.`);
  }
  return value;
}

function parseCoordinate(value: unknown, field: string, minimum: number, maximum: number): number | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be a number between ${minimum} and ${maximum}.`);
  }
  return value;
}

function parseOptionalId(value: unknown, field: string): number | null | undefined {
  if (value === undefined || value === null) return value;
  return parsePositiveInteger(value, field);
}

function parseRequiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be a string.`);
  }
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      `${field} must contain between 1 and ${maxLength} characters.`
    );
  }
  return normalized;
}

function validateCreateOrder(value: unknown): ValidatedCreateOrder {
  if (!isRecord(value)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request body must be a JSON object.');
  }

  const allowedFields = new Set([
    'brandId',
    'customerName',
    'customerPhone',
    'deliveryAddress',
    'deliveryZoneId',
    'deliveryLatitude',
    'deliveryLongitude',
    'courierId',
    'prepTimeMinutes',
    'items',
  ]);
  const unexpectedField = Object.keys(value).find((key) => !allowedFields.has(key));
  if (unexpectedField) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Unexpected field: ${unexpectedField}.`);
  }

  const brandId = parsePositiveInteger(value.brandId, 'brandId');
  const customerName = parseRequiredString(value.customerName, 'customerName', 120);
  const customerPhone = parseRequiredString(value.customerPhone, 'customerPhone', 32);
  const deliveryAddress = parseRequiredString(value.deliveryAddress, 'deliveryAddress', 500);
  const deliveryZoneId = parseOptionalId(value.deliveryZoneId, 'deliveryZoneId');
  const deliveryLatitude = parseCoordinate(value.deliveryLatitude, 'deliveryLatitude', -90, 90);
  const deliveryLongitude = parseCoordinate(value.deliveryLongitude, 'deliveryLongitude', -180, 180);
  if ((deliveryLatitude == null) !== (deliveryLongitude == null)) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'deliveryLatitude and deliveryLongitude must be provided together.'
    );
  }
  const courierId = parseOptionalId(value.courierId, 'courierId');
  const prepTimeMinutes =
    value.prepTimeMinutes === undefined
      ? undefined
      : parsePositiveInteger(value.prepTimeMinutes, 'prepTimeMinutes', 240);

  if (!Array.isArray(value.items) || value.items.length === 0 || value.items.length > 50) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'items must contain between 1 and 50 order items.');
  }

  const items = value.items.map((item, index): CreateOrderItem => {
    if (!isRecord(item)) {
      throw new ApiError(400, 'VALIDATION_ERROR', `items[${index}] must be an object.`);
    }
    const unexpectedItemField = Object.keys(item).find(
      (key) => !['menuItemId', 'quantity', 'specialInstructions'].includes(key)
    );
    if (unexpectedItemField) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        `Unexpected field in items[${index}]: ${unexpectedItemField}.`
      );
    }

    let specialInstructions = '';
    if (item.specialInstructions !== undefined) {
      if (typeof item.specialInstructions !== 'string' || item.specialInstructions.length > 500) {
        throw new ApiError(
          400,
          'VALIDATION_ERROR',
          `items[${index}].specialInstructions must be a string of at most 500 characters.`
        );
      }
      specialInstructions = item.specialInstructions.trim();
    }

    return {
      menuItemId: parsePositiveInteger(item.menuItemId, `items[${index}].menuItemId`),
      quantity: parsePositiveInteger(item.quantity, `items[${index}].quantity`, 99),
      specialInstructions,
    };
  });

  return {
    brandId,
    customerName,
    customerPhone,
    deliveryAddress,
    deliveryZoneId,
    deliveryLatitude,
    deliveryLongitude,
    courierId,
    prepTimeMinutes,
    items,
  };
}

function mapBrand(row: BrandRow): Brand {
  return {
    id: row.id,
    name: row.name,
    cuisineType: row.cuisine_type,
    color: row.color,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

function mapOrderStatus(status: string): Order['status'] {
  const mappedStatus = statusFromDatabase[status];
  if (!mappedStatus) {
    throw new ApiError(500, 'INVALID_STORED_STATUS', `Unsupported stored order status: ${status}.`);
  }
  return mappedStatus;
}

function mapOrder(row: OrderQueryRow, items: OrderItem[]): Order {
  return {
    id: row.id,
    orderRef: row.order_ref,
    brandId: row.brand_id,
    brandName: row.brand_name,
    brandColor: row.brand_color,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    deliveryAddress: row.delivery_address,
    deliveryZoneId: row.delivery_zone_id,
    deliveryZoneName: row.delivery_zone_name,
    kitchenStartedAt: row.kitchen_started_at,
    kitchenCompletedAt: row.kitchen_completed_at,
    courierId: row.courier_id,
    courierName: row.courier_name,
    status: mapOrderStatus(row.status),
    totalAmount: row.total_amount,
    prepTimeMinutes: row.prep_time_minutes,
    items,
    placedAt: row.placed_at,
    updatedAt: row.updated_at,
  };
}

const orderSelect = `
  SELECT o.*, b.name AS brand_name, b.color AS brand_color,
         z.name AS delivery_zone_name, c.name AS courier_name
  FROM orders o
  JOIN brands b ON b.id = o.brand_id
  LEFT JOIN delivery_zones z ON z.id = o.delivery_zone_id
  LEFT JOIN couriers c ON c.id = o.courier_id
`;

function mapOrderItems(rows: OrderItemQueryRow[]): OrderItem[] {
  return rows.map((row) => ({
    id: row.id,
    menuItemId: row.menu_item_id,
    menuItemName: row.menu_item_name,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    specialInstructions: row.special_instructions,
  }));
}

function getOrderItems(orderId: number): OrderItem[] {
  const rows = getDb()
    .prepare(
      `SELECT oi.*, mi.name AS menu_item_name
       FROM order_items oi
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       WHERE oi.order_id = ?
       ORDER BY oi.id`
    )
    .all(orderId) as OrderItemQueryRow[];
  return mapOrderItems(rows);
}

function getOrderById(id: number): Order | undefined {
  const row = getDb().prepare(`${orderSelect} WHERE o.id = ?`).get(id) as
    | OrderQueryRow
    | undefined;
  return row ? mapOrder(row, getOrderItems(id)) : undefined;
}

function getOrderOrThrow(id: number): Order {
  const order = getOrderById(id);
  if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  return order;
}

function getCreateOrderInput(req: Request): ValidatedCreateOrder {
  return validateCreateOrder(req.body);
}

const courierSelect = `
  SELECT c.*, z.name AS current_zone_name,
         (SELECT COUNT(*) FROM orders o
          WHERE o.courier_id = c.id
            AND o.status NOT IN ('delivered', 'cancelled')) AS active_orders
  FROM couriers c
  LEFT JOIN delivery_zones z ON z.id = c.current_zone_id
`;

function mapCourier(row: CourierQueryRow): Courier {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    vehicleType: row.vehicle_type,
    status: row.status,
    currentZoneId: row.current_zone_id,
    currentZoneName: row.current_zone_name,
    deliveriesToday: row.deliveries_today,
    activeOrders: row.active_orders,
    maxActiveOrders: row.max_active_orders,
    rating: row.rating,
    earningsToday: row.earnings_today,
  };
}

function getCourierById(id: number): Courier | undefined {
  const row = getDb().prepare(`${courierSelect} WHERE c.id = ?`).get(id) as
    | CourierQueryRow
    | undefined;
  return row ? mapCourier(row) : undefined;
}

function getCourierOrThrow(id: number): Courier {
  const courier = getCourierById(id);
  if (!courier) throw new ApiError(404, 'COURIER_NOT_FOUND', 'Courier not found.');
  return courier;
}

function assertCourierCanAcceptOrder(courierId: number): void {
  const courier = getDb()
    .prepare(
      `SELECT c.id, c.status, c.max_active_orders,
         (SELECT COUNT(*) FROM orders o
          WHERE o.courier_id = c.id
            AND o.status NOT IN ('delivered', 'cancelled')) AS active_orders
       FROM couriers c WHERE c.id = ?`
    )
    .get(courierId) as
    | { id: number; status: string; max_active_orders: number; active_orders: number }
    | undefined;
  if (!courier) throw new ApiError(404, 'COURIER_NOT_FOUND', 'Courier not found.');
  if (courier.status !== 'available') {
    throw new ApiError(409, 'COURIER_UNAVAILABLE', 'Courier is not available for assignments.');
  }
  if (courier.active_orders >= courier.max_active_orders) {
    throw new ApiError(409, 'COURIER_AT_CAPACITY', 'Courier has reached the active order capacity.');
  }
}

const MAX_BATCH_DISTANCE_KM = 2.5;
const MAX_BATCH_ORDERS = 20;
const batchStatuses: DeliveryBatchStatus[] = [
  'pending',
  'assigned',
  'in-progress',
  'completed',
  'cancelled',
];

const simulatedZonePointsKm: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 1.6, y: 0.4 },
  3: { x: 4, y: 0 },
  4: { x: 0, y: 4 },
};

interface BatchLocation {
  source: DeliveryBatchDistanceSource;
  first: number;
  second: number;
}

interface BatchQueryRow extends DeliveryBatchRow {
  delivery_zone_name: string | null;
  courier_name: string | null;
}

function getBatchLocation(order: OrderRow): BatchLocation | null {
  const hasLatitude = order.delivery_latitude !== null;
  const hasLongitude = order.delivery_longitude !== null;
  if (hasLatitude !== hasLongitude) {
    throw new ApiError(
      500,
      'INVALID_STORED_COORDINATES',
      `Order ${order.order_ref} has incomplete delivery coordinates.`
    );
  }
  if (hasLatitude && hasLongitude) {
    if (
      order.delivery_latitude! < -90 ||
      order.delivery_latitude! > 90 ||
      order.delivery_longitude! < -180 ||
      order.delivery_longitude! > 180
    ) {
      throw new ApiError(
        500,
        'INVALID_STORED_COORDINATES',
        `Order ${order.order_ref} has out-of-range delivery coordinates.`
      );
    }
    return {
      source: 'actual',
      first: order.delivery_latitude!,
      second: order.delivery_longitude!,
    };
  }

  const point = order.delivery_zone_id === null ? undefined : simulatedZonePointsKm[order.delivery_zone_id];
  return point ? { source: 'simulated', first: point.x, second: point.y } : null;
}

function distanceBetweenLocations(a: BatchLocation, b: BatchLocation): number {
  if (a.source !== b.source) {
    throw new ApiError(
      409,
      'MIXED_LOCATION_SOURCES',
      'Orders with real and simulated locations cannot be measured in the same batch.'
    );
  }
  if (a.source === 'simulated') {
    return Math.hypot(a.first - b.first, a.second - b.second);
  }

  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(b.first - a.first);
  const longitudeDelta = radians(b.second - a.second);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(a.first)) *
      Math.cos(radians(b.first)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function getBatchDistance(orders: OrderRow[]): {
  distanceKm: number;
  distanceSource: DeliveryBatchDistanceSource;
} {
  const locations = orders.map(getBatchLocation);
  if (locations.some((location) => location === null)) {
    throw new ApiError(
      409,
      'ORDER_LOCATION_UNAVAILABLE',
      'An order has no coordinates or delivery zone available for demo location simulation.'
    );
  }
  const resolved = locations as BatchLocation[];
  let maxDistance = 0;
  for (let left = 0; left < resolved.length; left += 1) {
    for (let right = left + 1; right < resolved.length; right += 1) {
      maxDistance = Math.max(
        maxDistance,
        distanceBetweenLocations(resolved[left], resolved[right])
      );
    }
  }
  return { distanceKm: maxDistance, distanceSource: resolved[0].source };
}

function getPreviouslyBatchedOrderIds(orderIds: number[]): Set<number> {
  if (orderIds.length === 0) return new Set();
  const placeholders = orderIds.map(() => '?').join(', ');
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT bo.order_id
       FROM delivery_batch_orders bo
       WHERE bo.order_id IN (${placeholders})`
    )
    .all(...orderIds) as Array<{ order_id: number }>;
  return new Set(rows.map((row) => row.order_id));
}

function getBatchOrders(batchId: number): Order[] {
  const rows = getDb()
    .prepare('SELECT order_id FROM delivery_batch_orders WHERE batch_id = ? ORDER BY order_id')
    .all(batchId) as Array<{ order_id: number }>;
  return rows.map((row) => getOrderOrThrow(row.order_id));
}

function getBatchRecommendations(
  batch: DeliveryBatchRow,
  orders: Order[]
): BatchCourierRecommendation[] {
  if (batch.status !== 'pending' || orders.length < 2 || orders.some((order) => order.status !== 'Packed')) {
    return [];
  }
  const candidates = getDb()
    .prepare(`${courierSelect} WHERE c.status = 'available'`)
    .all() as CourierQueryRow[];

  return candidates
    .map(mapCourier)
    .filter((courier) =>
      orders.every((order) => order.courierId === null || order.courierId === courier.id)
    )
    .map((courier) => {
      const additionalOrders = orders.filter((order) => order.courierId === null).length;
      return {
        ...courier,
        sameZone: batch.delivery_zone_id !== null && courier.currentZoneId === batch.delivery_zone_id,
        projectedActiveOrders: courier.activeOrders + additionalOrders,
      };
    })
    .filter((courier) => courier.projectedActiveOrders <= courier.maxActiveOrders)
    .sort((a, b) => {
      const zoneRank = (courier: BatchCourierRecommendation) =>
        batch.delivery_zone_id === null ? 0 : courier.sameZone ? 0 : courier.currentZoneId === null ? 1 : 2;
      return (
        zoneRank(a) - zoneRank(b) ||
        a.projectedActiveOrders / a.maxActiveOrders -
          b.projectedActiveOrders / b.maxActiveOrders ||
        a.projectedActiveOrders - b.projectedActiveOrders ||
        b.rating - a.rating
      );
    });
}

function getBatchById(id: number): DeliveryBatch | undefined {
  const row = getDb()
    .prepare(
      `SELECT b.*, z.name AS delivery_zone_name, c.name AS courier_name
       FROM delivery_batches b
       LEFT JOIN delivery_zones z ON z.id = b.delivery_zone_id
       LEFT JOIN couriers c ON c.id = b.courier_id
       WHERE b.id = ?`
    )
    .get(id) as BatchQueryRow | undefined;
  if (!row) return undefined;
  const orders = getBatchOrders(id);
  const courier = row.courier_id === null ? null : getCourierById(row.courier_id) ?? null;
  return {
    id: row.id,
    batchRef: row.batch_ref,
    deliveryZoneId: row.delivery_zone_id,
    deliveryZoneName: row.delivery_zone_name,
    courierId: row.courier_id,
    courierName: row.courier_name,
    status: row.status,
    distanceKm: row.distance_km,
    distanceSource: row.distance_source,
    orderCount: orders.length,
    orders,
    courier,
    recommendedCouriers: getBatchRecommendations(row, orders),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getBatchOrThrow(id: number): DeliveryBatch {
  const batch = getBatchById(id);
  if (!batch) throw new ApiError(404, 'BATCH_NOT_FOUND', 'Delivery batch not found.');
  return batch;
}

function validateBatchOrders(orderIds: number[]): OrderRow[] {
  const placeholders = orderIds.map(() => '?').join(', ');
  const rows = getDb()
    .prepare(`SELECT * FROM orders WHERE id IN (${placeholders}) ORDER BY id`)
    .all(...orderIds) as OrderRow[];
  if (rows.length !== orderIds.length) {
    throw new ApiError(404, 'ORDER_NOT_FOUND', 'One or more selected orders were not found.');
  }
  if (rows.some((order) => order.status !== 'ready')) {
    throw new ApiError(409, 'ORDER_NOT_PACKED', 'Only Packed orders can be added to a delivery batch.');
  }
  const alreadyBatched = getPreviouslyBatchedOrderIds(orderIds);
  if (alreadyBatched.size > 0) {
    throw new ApiError(
      409,
      'ORDER_ALREADY_BATCHED',
      'One or more orders have already been assigned to a delivery batch.'
    );
  }
  return rows;
}

function insertBatch(orderRows: OrderRow[]): number {
  const { distanceKm, distanceSource } = getBatchDistance(orderRows);
  if (distanceKm > MAX_BATCH_DISTANCE_KM) {
    throw new ApiError(
      400,
      'BATCH_DISTANCE_EXCEEDED',
      `Every order in a batch must be within ${MAX_BATCH_DISTANCE_KM} km of the others.`
    );
  }
  const zoneId = orderRows.every((order) => order.delivery_zone_id === orderRows[0].delivery_zone_id)
    ? orderRows[0].delivery_zone_id
    : null;
  const db = getDb();
  const batchRef = `B-${randomUUID().slice(0, 8).toUpperCase()}`;
  const result = db
    .prepare(
      `INSERT INTO delivery_batches (
        batch_ref, delivery_zone_id, status, distance_km, distance_source
      ) VALUES (?, ?, 'pending', ?, ?)`
    )
    .run(batchRef, zoneId, Math.round(distanceKm * 100) / 100, distanceSource);
  const batchId = Number(result.lastInsertRowid);
  const insertBatchOrder = db.prepare(
    'INSERT INTO delivery_batch_orders (batch_id, order_id) VALUES (?, ?)'
  );
  for (const order of orderRows) insertBatchOrder.run(batchId, order.id);
  return batchId;
}

function groupEligibleOrders(rows: OrderRow[]): OrderRow[][] {
  const ordered = rows
    .map((order) => ({ order, location: getBatchLocation(order) }))
    .filter((entry): entry is { order: OrderRow; location: BatchLocation } => entry.location !== null)
    .sort((a, b) => a.order.id - b.order.id);
  const groups: Array<Array<{ order: OrderRow; location: BatchLocation }>> = [];
  for (const entry of ordered) {
    const group = groups.find((candidate) =>
      candidate.length < MAX_BATCH_ORDERS && candidate.every(
        (member) =>
          member.location.source === entry.location.source &&
          distanceBetweenLocations(member.location, entry.location) <= MAX_BATCH_DISTANCE_KM
      )
    );
    if (group) group.push(entry);
    else groups.push([entry]);
  }
  return groups
    .filter((group) => group.length >= 2)
    .map((group) => group.map((entry) => entry.order));
}

router.get('/brands', (_req, res) => {
  const rows = getDb()
    .prepare('SELECT * FROM brands ORDER BY id')
    .all() as BrandRow[];
  res.json({ data: rows.map(mapBrand) });
});

router.get('/brands/:id', (req, res) => {
  const id = parseId(req.params.id);
  const row = getDb().prepare('SELECT * FROM brands WHERE id = ?').get(id) as
    | BrandRow
    | undefined;
  if (!row) throw new ApiError(404, 'BRAND_NOT_FOUND', 'Brand not found.');
  res.json({ data: mapBrand(row) });
});

router.get('/orders', (_req, res) => {
  const rows = getDb()
    .prepare(`${orderSelect} ORDER BY o.placed_at DESC, o.id DESC`)
    .all() as OrderQueryRow[];

  const itemsByOrder = new Map<number, OrderItem[]>();
  if (rows.length > 0) {
    const placeholders = rows.map(() => '?').join(', ');
    const itemRows = getDb()
      .prepare(
        `SELECT oi.*, mi.name AS menu_item_name
         FROM order_items oi
         JOIN menu_items mi ON mi.id = oi.menu_item_id
         WHERE oi.order_id IN (${placeholders})
         ORDER BY oi.order_id, oi.id`
      )
      .all(...rows.map((row) => row.id)) as OrderItemQueryRow[];
    for (const row of itemRows) {
      const items = itemsByOrder.get(row.order_id) ?? [];
      items.push(...mapOrderItems([row]));
      itemsByOrder.set(row.order_id, items);
    }
  }

  res.json({
    data: rows.map((row) => mapOrder(row, itemsByOrder.get(row.id) ?? [])),
  });
});

router.get('/orders/:id', (req, res) => {
  const id = parseId(req.params.id);
  res.json({ data: getOrderOrThrow(id) });
});

router.get('/orders/:id/recommended-couriers', (req, res) => {
  const orderId = parseId(req.params.id);
  const order = getDb()
    .prepare('SELECT id, delivery_zone_id, courier_id, status FROM orders WHERE id = ?')
    .get(orderId) as
    | { id: number; delivery_zone_id: number | null; courier_id: number | null; status: string }
    | undefined;
  if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  if (order.courier_id !== null) {
    throw new ApiError(409, 'ORDER_ALREADY_ASSIGNED', 'Order already has a courier assigned.');
  }
  if (order.status === 'delivered' || order.status === 'cancelled') {
    throw new ApiError(409, 'ORDER_NOT_ASSIGNABLE', 'Completed or cancelled orders cannot be assigned.');
  }

  const candidates = getDb()
    .prepare(`${courierSelect} WHERE c.status = 'available'`)
    .all() as CourierQueryRow[];

  const recommendations: CourierRecommendation[] = candidates
    .filter((courier) => courier.active_orders < courier.max_active_orders)
    .map((courier) => ({
      ...mapCourier(courier),
      sameZone:
        order.delivery_zone_id !== null && courier.current_zone_id === order.delivery_zone_id,
    }))
    .sort((a, b) => {
      const zoneRank = (courier: CourierRecommendation) => {
        if (order.delivery_zone_id === null) return 0;
        if (courier.sameZone) return 0;
        return courier.currentZoneId === null ? 1 : 2;
      };
      return (
        zoneRank(a) - zoneRank(b) ||
        a.activeOrders / a.maxActiveOrders - b.activeOrders / b.maxActiveOrders ||
        a.activeOrders - b.activeOrders ||
        b.rating - a.rating
      );
    });

  res.json({ data: recommendations });
});

router.patch('/orders/:id/assign-courier', (req, res) => {
  const orderId = parseId(req.params.id);
  if (!isRecord(req.body) || Object.keys(req.body).length !== 1 || !('courierId' in req.body)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request body must contain only a courierId field.');
  }
  const courierId = parsePositiveInteger(req.body.courierId, 'courierId');
  const db = getDb();

  const assign = db.transaction(() => {
    const order = db
      .prepare('SELECT id, courier_id, status FROM orders WHERE id = ?')
      .get(orderId) as { id: number; courier_id: number | null; status: string } | undefined;
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    if (order.courier_id !== null) {
      throw new ApiError(409, 'ORDER_ALREADY_ASSIGNED', 'Order already has a courier assigned.');
    }
    if (order.status === 'delivered' || order.status === 'cancelled') {
      throw new ApiError(409, 'ORDER_NOT_ASSIGNABLE', 'Completed or cancelled orders cannot be assigned.');
    }
    const activeBatch = db
      .prepare(
        `SELECT b.batch_ref
         FROM delivery_batch_orders bo
         JOIN delivery_batches b ON b.id = bo.batch_id
         WHERE bo.order_id = ?
           AND b.status IN ('pending', 'assigned', 'in-progress')
         LIMIT 1`
      )
      .get(orderId) as { batch_ref: string } | undefined;
    if (activeBatch) {
      throw new ApiError(
        409,
        'ORDER_IN_ACTIVE_BATCH',
        `Order is part of ${activeBatch.batch_ref}; assign its courier through Delivery Batching.`
      );
    }

    assertCourierCanAcceptOrder(courierId);

    const result = db
      .prepare(
        `UPDATE orders SET courier_id = ?, updated_at = datetime(?)
         WHERE id = ? AND courier_id IS NULL`
      )
      .run(courierId, new Date().toISOString(), orderId);
    if (result.changes !== 1) {
      throw new ApiError(409, 'ORDER_ALREADY_ASSIGNED', 'Order already has a courier assigned.');
    }
  });
  assign.immediate();

  const assignment: CourierAssignment = {
    order: getOrderOrThrow(orderId),
    courier: getCourierOrThrow(courierId),
  };
  res.json({ data: assignment });
});

router.patch('/orders/:id/status', (req, res) => {
  const id = parseId(req.params.id);
  if (!isRecord(req.body) || Object.keys(req.body).length !== 1 || !('status' in req.body)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request body must contain only a status field.');
  }
  const status = req.body.status;
  if (typeof status !== 'string' || !ORDER_STATUSES.some((allowed) => allowed === status)) {
    throw new ApiError(
      400,
      'INVALID_ORDER_STATUS',
      `status must be one of: ${ORDER_STATUSES.join(', ')}.`
    );
  }

  const db = getDb();
  const existing = db
    .prepare('SELECT id, status, courier_id FROM orders WHERE id = ?')
    .get(id) as { id: number; status: string; courier_id: number | null } | undefined;
  if (!existing) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');

  const nextStatus = statusToDatabase[status as OrderStatus];
  if (existing.status === nextStatus) {
    res.json({ data: getOrderOrThrow(id) });
    return;
  }
  if (nextDatabaseOrderStatus[existing.status] !== nextStatus) {
    throw new ApiError(
      409,
      'INVALID_ORDER_TRANSITION',
      'Orders must move forward one step at a time through the delivery workflow.'
    );
  }
  const activeBatch = db
    .prepare(
      `SELECT b.batch_ref
       FROM delivery_batch_orders bo
       JOIN delivery_batches b ON b.id = bo.batch_id
       WHERE bo.order_id = ?
         AND b.status IN ('pending', 'assigned', 'in-progress')
       LIMIT 1`
    )
    .get(id) as { batch_ref: string } | undefined;
  if (activeBatch) {
    throw new ApiError(
      409,
      'ORDER_IN_ACTIVE_BATCH',
      `Order is part of ${activeBatch.batch_ref}; update or cancel that batch first.`
    );
  }

  const now = new Date().toISOString();
  if (nextStatus === 'preparing' && existing.status !== 'preparing') {
    db.prepare(
      `UPDATE orders
       SET status = ?, updated_at = datetime(?), kitchen_started_at = datetime(?), kitchen_completed_at = NULL
       WHERE id = ?`
    ).run(nextStatus, now, now, id);
  } else if (existing.status === 'preparing' && nextStatus !== 'preparing') {
    db.prepare(
      `UPDATE orders
       SET status = ?, updated_at = datetime(?),
           kitchen_completed_at = CASE WHEN kitchen_started_at IS NULL THEN NULL ELSE datetime(?) END
       WHERE id = ?`
    ).run(nextStatus, now, now, id);
  } else {
    db.prepare('UPDATE orders SET status = ?, updated_at = datetime(?) WHERE id = ?').run(
      nextStatus,
      now,
      id
    );
  }
  if (nextStatus === 'dispatched' && existing.courier_id !== null) {
    db.prepare(
      "UPDATE couriers SET status = 'on-delivery' WHERE id = ? AND status = 'available'"
    ).run(existing.courier_id);
  } else if (nextStatus === 'delivered' && existing.courier_id !== null) {
    db.prepare('UPDATE couriers SET deliveries_today = deliveries_today + 1 WHERE id = ?').run(
      existing.courier_id
    );
    const activeOrders = (
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM orders
           WHERE courier_id = ? AND status NOT IN ('delivered', 'cancelled')`
        )
        .get(existing.courier_id) as { count: number }
    ).count;
    if (activeOrders === 0) {
      db.prepare(
        "UPDATE couriers SET status = 'available' WHERE id = ? AND status = 'on-delivery'"
      ).run(existing.courier_id);
    }
  }
  res.json({ data: getOrderOrThrow(id) });
});

router.post('/orders', (req, res) => {
  const input = getCreateOrderInput(req);
  const db = getDb();
  const createOrder = db.transaction((order: ValidatedCreateOrder) => {
    const brand = db
      .prepare('SELECT id, is_active FROM brands WHERE id = ?')
      .get(order.brandId) as { id: number; is_active: number } | undefined;
    if (!brand) {
      throw new ApiError(404, 'BRAND_NOT_FOUND', 'Brand not found.');
    }
    if (brand.is_active !== 1) {
      throw new ApiError(409, 'BRAND_UNAVAILABLE', 'Orders cannot be placed with an inactive brand.');
    }
    if (
      order.deliveryZoneId !== undefined &&
      order.deliveryZoneId !== null &&
      !db.prepare('SELECT id FROM delivery_zones WHERE id = ?').get(order.deliveryZoneId)
    ) {
      throw new ApiError(404, 'DELIVERY_ZONE_NOT_FOUND', 'Delivery zone not found.');
    }
    if (order.courierId !== undefined && order.courierId !== null) {
      assertCourierCanAcceptOrder(order.courierId);
    }

    const menuItemQuery = db.prepare(
      'SELECT id, brand_id, price, is_available FROM menu_items WHERE id = ?'
    );
    const pricedItems = order.items.map((item) => {
      const menuItem = menuItemQuery.get(item.menuItemId) as
        | { id: number; brand_id: number; price: number; is_available: number }
        | undefined;
      if (!menuItem) {
        throw new ApiError(404, 'MENU_ITEM_NOT_FOUND', `Menu item ${item.menuItemId} not found.`);
      }
      if (menuItem.brand_id !== order.brandId) {
        throw new ApiError(
          400,
          'MENU_ITEM_BRAND_MISMATCH',
          `Menu item ${item.menuItemId} does not belong to the selected brand.`
        );
      }
      if (menuItem.is_available !== 1) {
        throw new ApiError(
          400,
          'MENU_ITEM_UNAVAILABLE',
          `Menu item ${item.menuItemId} is not available.`
        );
      }
      return { ...item, unitPrice: menuItem.price };
    });

    let orderRef: string;
    do {
      orderRef = `DD-${randomUUID().slice(0, 8).toUpperCase()}`;
    } while (db.prepare('SELECT 1 FROM orders WHERE order_ref = ?').get(orderRef));

    const totalAmount = Math.round(
      pricedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) * 100
    ) / 100;
    const result = db
      .prepare(
        `INSERT INTO orders (
          order_ref, brand_id, customer_name, customer_phone, delivery_address,
          delivery_zone_id, delivery_latitude, delivery_longitude, courier_id,
          status, total_amount, prep_time_minutes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        orderRef,
        order.brandId,
        order.customerName,
        order.customerPhone,
        order.deliveryAddress,
        order.deliveryZoneId ?? null,
        order.deliveryLatitude ?? null,
        order.deliveryLongitude ?? null,
        order.courierId ?? null,
        statusToDatabase.Received,
        totalAmount,
        order.prepTimeMinutes ?? 20
      );
    const orderId = Number(result.lastInsertRowid);
    const insertItem = db.prepare(
      `INSERT INTO order_items (
        order_id, menu_item_id, quantity, unit_price, special_instructions
      ) VALUES (?, ?, ?, ?, ?)`
    );
    for (const item of pricedItems) {
      insertItem.run(
        orderId,
        item.menuItemId,
        item.quantity,
        item.unitPrice,
        item.specialInstructions
      );
    }
    return orderId;
  });

  const id = createOrder(input);
  res.status(201).json({ data: getOrderOrThrow(id) });
});

router.patch('/couriers/:id/status', (req, res) => {
  const id = parseId(req.params.id);
  if (!isRecord(req.body) || Object.keys(req.body).length !== 1 || !('status' in req.body)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request body must contain only a status field.');
  }
  const allowedStatuses = ['available', 'on-delivery', 'offline'];
  const status = req.body.status;
  if (typeof status !== 'string' || !allowedStatuses.includes(status)) {
    throw new ApiError(
      400,
      'INVALID_COURIER_STATUS',
      `status must be one of: ${allowedStatuses.join(', ')}.`
    );
  }

  const db = getDb();
  const current = getCourierById(id);
  if (!current) throw new ApiError(404, 'COURIER_NOT_FOUND', 'Courier not found.');
  if (status === 'available' && current.activeOrders >= current.maxActiveOrders) {
    throw new ApiError(
      409,
      'COURIER_AT_CAPACITY',
      'Courier cannot be marked available while at active order capacity.'
    );
  }

  db.prepare('UPDATE couriers SET status = ? WHERE id = ?').run(status, id);
  res.json({ data: getCourierOrThrow(id) });
});

router.get('/couriers', (_req, res) => {
  const rows = getDb()
    .prepare(`${courierSelect} ORDER BY c.id`)
    .all() as CourierQueryRow[];
  res.json({ data: rows.map(mapCourier) });
});

router.get('/couriers/:id', (req, res) => {
  const id = parseId(req.params.id);
  res.json({ data: getCourierOrThrow(id) });
});

router.get('/zones', (_req, res) => {
  const rows = getDb()
    .prepare(
      `SELECT z.*,
         (SELECT COUNT(*) FROM orders o
          WHERE o.delivery_zone_id = z.id
            AND o.status NOT IN ('delivered', 'cancelled')) AS active_orders,
         (SELECT COUNT(*) FROM couriers c
          WHERE c.current_zone_id = z.id AND c.status != 'offline') AS assigned_couriers
       FROM delivery_zones z
       ORDER BY z.id`
    )
    .all() as Array<{
    id: number;
    name: string;
    sector: string;
    area_coverage: string;
    base_delivery_fee: number;
    active_orders: number;
    assigned_couriers: number;
  }>;
  const data: DeliveryZone[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    sector: row.sector,
    areaCoverage: row.area_coverage,
    baseDeliveryFee: row.base_delivery_fee,
    activeOrders: row.active_orders,
    assignedCouriers: row.assigned_couriers,
  }));
  res.json({ data });
});

router.get('/batches', (_req, res) => {
  const rows = getDb()
    .prepare('SELECT id FROM delivery_batches ORDER BY created_at DESC, id DESC')
    .all() as Array<{ id: number }>;
  res.json({ data: rows.map((row) => getBatchOrThrow(row.id)) });
});

router.get('/batches/:id/recommended-couriers', (req, res) => {
  const batchId = parseId(req.params.id);
  const batch = getBatchOrThrow(batchId);
  res.json({ data: batch.recommendedCouriers });
});

router.get('/batches/:id', (req, res) => {
  const id = parseId(req.params.id);
  res.json({ data: getBatchOrThrow(id) });
});

router.post('/batches/generate', (req, res) => {
  if (
    req.body !== undefined &&
    (!isRecord(req.body) || Object.keys(req.body).length !== 0)
  ) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Batch generation does not accept request fields.');
  }

  const db = getDb();
  const generate = db.transaction(() => {
    const orders = db
      .prepare(
        `SELECT o.* FROM orders o
         WHERE o.status = 'ready'
           AND NOT EXISTS (
             SELECT 1
             FROM delivery_batch_orders bo
             WHERE bo.order_id = o.id
           )
         ORDER BY o.id`
      )
      .all() as OrderRow[];
    const groups = groupEligibleOrders(orders);
    return groups.map((group) => insertBatch(group));
  });
  const ids = generate.immediate();
  res.status(201).json({ data: ids.map((id) => getBatchOrThrow(id)) });
});

router.post('/batches', (req, res) => {
  if (!isRecord(req.body) || Object.keys(req.body).length !== 1 || !('orderIds' in req.body)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request body must contain only an orderIds field.');
  }
  const inputIds = req.body.orderIds;
  if (
    !Array.isArray(inputIds) ||
    inputIds.length < 2 ||
    inputIds.length > MAX_BATCH_ORDERS
  ) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      `orderIds must contain between 2 and ${MAX_BATCH_ORDERS} order IDs.`
    );
  }
  const orderIds = inputIds.map((id, index) =>
    parsePositiveInteger(id, `orderIds[${index}]`)
  );
  if (new Set(orderIds).size !== orderIds.length) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'orderIds cannot contain duplicates.');
  }

  const create = getDb().transaction(() => {
    const orders = validateBatchOrders(orderIds);
    return insertBatch(orders);
  });
  const id = create.immediate();
  res.status(201).json({ data: getBatchOrThrow(id) });
});

router.patch('/batches/:id/assign-courier', (req, res) => {
  const batchId = parseId(req.params.id);
  if (!isRecord(req.body) || Object.keys(req.body).length !== 1 || !('courierId' in req.body)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request body must contain only a courierId field.');
  }
  const courierId = parsePositiveInteger(req.body.courierId, 'courierId');
  const db = getDb();
  const assign = db.transaction(() => {
    const batch = db
      .prepare('SELECT id, status, courier_id FROM delivery_batches WHERE id = ?')
      .get(batchId) as { id: number; status: DeliveryBatchStatus; courier_id: number | null } | undefined;
    if (!batch) throw new ApiError(404, 'BATCH_NOT_FOUND', 'Delivery batch not found.');
    if (batch.status !== 'pending' || batch.courier_id !== null) {
      throw new ApiError(409, 'BATCH_ALREADY_ASSIGNED', 'Only a pending, unassigned batch can be assigned.');
    }

    const orders = db
      .prepare(
        `SELECT o.id, o.courier_id, o.status
         FROM delivery_batch_orders bo
         JOIN orders o ON o.id = bo.order_id
         WHERE bo.batch_id = ?`
      )
      .all(batchId) as Array<{ id: number; courier_id: number | null; status: string }>;
    if (orders.length < 2 || orders.some((order) => order.status !== 'ready')) {
      throw new ApiError(
        409,
        'BATCH_ORDERS_NOT_PACKED',
        'Every order in the batch must still be Packed before courier assignment.'
      );
    }
    if (orders.some((order) => order.courier_id !== null && order.courier_id !== courierId)) {
      throw new ApiError(
        409,
        'ORDER_COURIER_CONFLICT',
        'The batch contains an order assigned to a different courier.'
      );
    }

    const courierRow = db
      .prepare(
        `SELECT c.id, c.status, c.max_active_orders,
           (SELECT COUNT(*) FROM orders o
            WHERE o.courier_id = c.id
              AND o.status NOT IN ('delivered', 'cancelled')) AS active_orders
         FROM couriers c WHERE c.id = ?`
      )
      .get(courierId) as
      | { id: number; status: string; max_active_orders: number; active_orders: number }
      | undefined;
    if (!courierRow) throw new ApiError(404, 'COURIER_NOT_FOUND', 'Courier not found.');
    if (courierRow.status !== 'available') {
      throw new ApiError(409, 'COURIER_UNAVAILABLE', 'Courier is not available for assignments.');
    }
    const additionalOrders = orders.filter((order) => order.courier_id === null).length;
    if (courierRow.active_orders + additionalOrders > courierRow.max_active_orders) {
      throw new ApiError(
        409,
        'COURIER_AT_CAPACITY',
        'Courier does not have enough remaining capacity for this batch.'
      );
    }

    const assignOrder = db.prepare(
      `UPDATE orders SET courier_id = ?, updated_at = datetime(?)
       WHERE id = ? AND courier_id IS NULL`
    );
    const now = new Date().toISOString();
    for (const order of orders) {
      if (order.courier_id === null) assignOrder.run(courierId, now, order.id);
    }
    db.prepare(
      `UPDATE delivery_batches
       SET courier_id = ?, status = 'assigned', updated_at = datetime(?)
       WHERE id = ? AND status = 'pending' AND courier_id IS NULL`
    ).run(courierId, now, batchId);
  });
  assign.immediate();
  res.json({ data: getBatchOrThrow(batchId) });
});

router.patch('/batches/:id/status', (req, res) => {
  const batchId = parseId(req.params.id);
  if (!isRecord(req.body) || Object.keys(req.body).length !== 1 || !('status' in req.body)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request body must contain only a status field.');
  }
  const requestedStatus = req.body.status;
  if (
    typeof requestedStatus !== 'string' ||
    !batchStatuses.includes(requestedStatus as DeliveryBatchStatus)
  ) {
    throw new ApiError(
      400,
      'INVALID_BATCH_STATUS',
      `status must be one of: ${batchStatuses.join(', ')}.`
    );
  }

  const nextStatus = requestedStatus as DeliveryBatchStatus;
  const db = getDb();
  const update = db.transaction(() => {
    const batch = db
      .prepare('SELECT id, status, courier_id FROM delivery_batches WHERE id = ?')
      .get(batchId) as { id: number; status: DeliveryBatchStatus; courier_id: number | null } | undefined;
    if (!batch) throw new ApiError(404, 'BATCH_NOT_FOUND', 'Delivery batch not found.');
    if (batch.status === nextStatus) return;
    if (batch.status === 'completed' || batch.status === 'cancelled') {
      throw new ApiError(409, 'BATCH_CLOSED', 'Completed or cancelled batches cannot be updated.');
    }
    if (nextStatus === 'assigned') {
      throw new ApiError(400, 'INVALID_BATCH_TRANSITION', 'Assign a courier using the batch assignment endpoint.');
    }
    if (nextStatus === 'in-progress' && (batch.status !== 'assigned' || batch.courier_id === null)) {
      throw new ApiError(409, 'BATCH_NOT_ASSIGNED', 'A batch must have an assigned courier before it can start.');
    }
    if (nextStatus === 'completed' && batch.status !== 'in-progress') {
      throw new ApiError(409, 'INVALID_BATCH_TRANSITION', 'Only in-progress batches can be completed.');
    }
    if (nextStatus === 'cancelled' && (batch.status !== 'pending' || batch.courier_id !== null)) {
      throw new ApiError(409, 'INVALID_BATCH_TRANSITION', 'Only an unassigned pending batch can be cancelled.');
    }
    if (!['in-progress', 'completed', 'cancelled'].includes(nextStatus)) {
      throw new ApiError(409, 'INVALID_BATCH_TRANSITION', 'The requested batch status transition is not allowed.');
    }
    if (nextStatus === 'in-progress' || nextStatus === 'completed') {
      const expectedOrderStatus = nextStatus === 'in-progress' ? 'ready' : 'dispatched';
      const nextOrderStatus = nextStatus === 'in-progress' ? 'dispatched' : 'delivered';
      const result = db
        .prepare(
          `UPDATE orders
           SET status = ?, updated_at = datetime(?)
           WHERE id IN (SELECT order_id FROM delivery_batch_orders WHERE batch_id = ?)
             AND status = ?`
        )
        .run(nextOrderStatus, new Date().toISOString(), batchId, expectedOrderStatus);
      const orderCount = (
        db.prepare('SELECT COUNT(*) AS count FROM delivery_batch_orders WHERE batch_id = ?').get(batchId) as {
          count: number;
        }
      ).count;
      if (orderCount < 2 || result.changes !== orderCount) {
        throw new ApiError(
          409,
          'BATCH_ORDERS_OUT_OF_SYNC',
          'Every order in the batch must be at the expected delivery stage.'
        );
      }
      if (nextStatus === 'in-progress') {
        const courier = db
          .prepare('SELECT status FROM couriers WHERE id = ?')
          .get(batch.courier_id) as { status: string } | undefined;
        if (!courier || courier.status === 'offline') {
          throw new ApiError(
            409,
            'COURIER_UNAVAILABLE',
            'The assigned courier is offline and cannot start this delivery.'
          );
        }
        db.prepare("UPDATE couriers SET status = 'on-delivery' WHERE id = ?").run(batch.courier_id);
      } else if (batch.courier_id !== null) {
        db.prepare('UPDATE couriers SET deliveries_today = deliveries_today + ? WHERE id = ?').run(
          orderCount,
          batch.courier_id
        );
        const activeOrders = (
          db
            .prepare(
              `SELECT COUNT(*) AS count FROM orders
               WHERE courier_id = ? AND status NOT IN ('delivered', 'cancelled')`
            )
            .get(batch.courier_id) as { count: number }
        ).count;
        if (activeOrders === 0) {
          db.prepare(
            "UPDATE couriers SET status = 'available' WHERE id = ? AND status = 'on-delivery'"
          ).run(batch.courier_id);
        }
      }
    }
    db.prepare('UPDATE delivery_batches SET status = ?, updated_at = datetime(?) WHERE id = ?').run(
      nextStatus,
      new Date().toISOString(),
      batchId
    );
  });
  update.immediate();
  res.json({ data: getBatchOrThrow(batchId) });
});

export { router as apiRouter };
