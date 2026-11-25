import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import { unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

const testDatabasePath = path.join(tmpdir(), `dabbadash-test-${randomUUID()}.db`);
process.env.DABBADASH_DB_PATH = testDatabasePath;
process.env.DABBADASH_DEMO_SEED = 'false';
process.env.NODE_ENV = 'test';

type ConnectionModule = typeof import('../src/db/connection');
type ApiResponse = {
  data?: unknown;
  error?: { code: string; message: string };
  openapi?: string;
};
type OrderResponse = {
  id: number;
  status: string;
  customerName?: string;
  deliveryAddress?: string;
  totalAmount?: number;
  items?: unknown[];
  courierId?: number | null;
};
type BatchResponse = {
  id: number;
  distanceKm: number;
  distanceSource?: string;
  orders: Array<{ id: number; status: string }>;
};

let connection: ConnectionModule | undefined;
let createSchema: typeof import('../src/db/schema')['createSchema'] = () => {
  throw new Error('Test database is not initialized.');
};
let createApp: typeof import('../src/app')['createApp'] = () => {
  throw new Error('Test app is not initialized.');
};

type TestOrder = {
  id: number;
  status: string;
  zoneId: number | null;
  latitude?: number | null;
  longitude?: number | null;
  courierId?: number | null;
};

let server: Server | undefined;
let baseUrl = '';

function getTestDb(): ReturnType<ConnectionModule['getDb']> {
  if (!connection) throw new Error('Test database is not initialized.');
  return connection.getDb();
}

function resetDatabase(): void {
  const db = getTestDb();
  db.exec(`
    DELETE FROM delivery_batch_orders;
    DELETE FROM delivery_batches;
    DELETE FROM order_items;
    DELETE FROM orders;
    DELETE FROM couriers;
    DELETE FROM menu_items;
    DELETE FROM delivery_zones;
    DELETE FROM brands;
    DELETE FROM app_metadata;
  `);
  db.prepare(
    'INSERT INTO brands (id, name, cuisine_type, color) VALUES (1, ?, ?, ?), (2, ?, ?, ?)'
  ).run('Test Kitchen', 'Indian', '#596344', 'Other Kitchen', 'Other', '#702d43');
  db.prepare(
    `INSERT INTO delivery_zones (id, name, sector, area_coverage)
     VALUES (1, 'Zone One', 'A', 'Area A'), (2, 'Zone Two', 'B', 'Area B'),
            (3, 'Zone Three', 'C', 'Area C')`
  ).run();
  db.prepare(
    `INSERT INTO couriers (id, name, phone, status, current_zone_id, max_active_orders)
     VALUES (1, 'Available Courier', 'test-1', 'available', 1, 2),
            (2, 'Batch Courier', 'test-2', 'available', 2, 3),
            (3, 'Offline Courier', 'test-3', 'offline', 1, 3)`
  ).run();
  db.prepare(
    `INSERT INTO menu_items (id, brand_id, name, description, price, category)
     VALUES (1, 1, 'Test Meal', '', 10, 'Meals'),
            (2, 1, 'Side', '', 5, 'Sides'),
            (3, 2, 'Other Meal', '', 20, 'Meals')`
  ).run();
  addOrder({ status: 'pending', zoneId: 1, courierId: 1 }, 'BASE-ACTIVE');
}

function addOrder(
  order: Omit<TestOrder, 'id'>,
  orderRef = `TEST-${randomUUID().slice(0, 8)}`
): number {
  const result = getTestDb()
    .prepare(
      `INSERT INTO orders (
        order_ref, brand_id, customer_name, customer_phone, delivery_address,
        delivery_zone_id, delivery_latitude, delivery_longitude, courier_id,
        status, total_amount
      ) VALUES (?, 1, 'Test Customer', 'test-phone', 'Test Address', ?, ?, ?, ?, ?, 10)`
    )
    .run(
      orderRef,
      order.zoneId,
      order.latitude ?? null,
      order.longitude ?? null,
      order.courierId ?? null,
      order.status
    );
  return Number(result.lastInsertRowid);
}

async function request(
  endpoint: string,
  method = 'GET',
  body?: unknown
): Promise<{ status: number; body: ApiResponse; headers: Headers }> {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    body: (await response.json()) as ApiResponse,
    headers: response.headers,
  };
}

function data<T>(result: { body: ApiResponse }): T {
  return result.body.data as T;
}

function errorCode(result: { body: ApiResponse }): string | undefined {
  return result.body.error?.code;
}

describe('DabbaDash API', () => {
  before(async () => {
    connection = await import('../src/db/connection');
    const schema = await import('../src/db/schema');
    const appModule = await import('../src/app');
    createSchema = schema.createSchema;
    createApp = appModule.createApp;
    createSchema();
    const app = createApp();
    const activeServer = app.listen(0, '127.0.0.1');
    server = activeServer;
    await new Promise<void>((resolve, reject) => {
      activeServer.once('listening', resolve);
      activeServer.once('error', reject);
    });
    const address = activeServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(resetDatabase);

  after(async () => {
    const activeServer = server;
    if (activeServer?.listening) {
      await new Promise<void>((resolve, reject) =>
        activeServer.close((error) => (error ? reject(error) : resolve()))
      );
    }
    connection?.closeDb();
    for (const suffix of ['', '-wal', '-shm']) {
      try {
        unlinkSync(`${testDatabasePath}${suffix}`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
  });

  it('rejects invalid order input with the established error envelope', async () => {
    const result = await request('/api/orders', 'POST', {
      brandId: 1,
      customerName: 'Test',
      customerPhone: '555',
      deliveryAddress: 'Address',
      items: [],
    });
    assert.equal(result.status, 400);
    assert.equal(errorCode(result), 'VALIDATION_ERROR');
    assert.equal(typeof result.body.error?.message, 'string');
  });

  it('validates paired coordinates and disallows unexpected order fields', async () => {
    const partialCoordinates = await request('/api/orders', 'POST', {
      brandId: 1,
      customerName: 'Test',
      customerPhone: '555',
      deliveryAddress: 'Address',
      deliveryLatitude: 10,
      items: [{ menuItemId: 1, quantity: 1 }],
    });
    const extraField = await request('/api/orders', 'POST', {
      brandId: 1,
      customerName: 'Test',
      customerPhone: '555',
      deliveryAddress: 'Address',
      isAdmin: true,
      items: [{ menuItemId: 1, quantity: 1 }],
    });
    assert.equal(partialCoordinates.status, 400);
    assert.equal(extraField.status, 400);
  });

  it('creates valid orders using current database prices', async () => {
    const result = await request('/api/orders', 'POST', {
      brandId: 1,
      customerName: '  Test Customer  ',
      customerPhone: '555-0100',
      deliveryAddress: '  Test Address  ',
      deliveryZoneId: 1,
      items: [
        { menuItemId: 1, quantity: 2 },
        { menuItemId: 2, quantity: 1, specialInstructions: 'No salt' },
      ],
    });
    assert.equal(result.status, 201);
    const order = data<OrderResponse>(result);
    assert.equal(order.customerName, 'Test Customer');
    assert.equal(order.deliveryAddress, 'Test Address');
    assert.equal(order.totalAmount, 25);
    assert.equal(order.items?.length, 2);
  });

  it('allows valid next-step transitions and rejects skipped order states', async () => {
    const orderId = addOrder({ status: 'pending', zoneId: 1 });
    const start = await request(`/api/orders/${orderId}/status`, 'PATCH', { status: 'In Kitchen' });
    const skip = await request(`/api/orders/${orderId}/status`, 'PATCH', { status: 'Delivered' });
    const finishPrep = await request(`/api/orders/${orderId}/status`, 'PATCH', { status: 'Packed' });
    assert.equal(start.status, 200);
    assert.equal(data<OrderResponse>(start).status, 'In Kitchen');
    assert.equal(skip.status, 409);
    assert.equal(errorCode(skip), 'INVALID_ORDER_TRANSITION');
    assert.equal(finishPrep.status, 200);
    assert.equal(data<OrderResponse>(finishPrep).status, 'Packed');
  });

  it('rejects malformed JSON without echoing parser details', async () => {
    const response = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"secret":"never echo this",',
    });
    const body = (await response.json()) as { error: { code: string; message: string } };
    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'INVALID_JSON');
    assert.equal(body.error.message, 'Malformed JSON request body.');
    assert.equal(JSON.stringify(body).includes('never echo this'), false);
    assert.ok(response.headers.get('x-request-id'));
  });

  it('rejects request bodies larger than the configured parser limit', async () => {
    const response = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: `{"padding":"${'x'.repeat(1024 * 1024)}"}`,
    });
    const body = (await response.json()) as { error: { code: string } };
    assert.equal(response.status, 413);
    assert.equal(body.error.code, 'PAYLOAD_TOO_LARGE');
  });

  it('permits assignments up to capacity and rejects assignments beyond capacity', async () => {
    const withinCapacity = await request('/api/orders', 'POST', {
      brandId: 1,
      customerName: 'Test',
      customerPhone: '555',
      deliveryAddress: 'Address',
      courierId: 1,
      items: [{ menuItemId: 1, quantity: 1 }],
    });
    const overCapacity = await request('/api/orders', 'POST', {
      brandId: 1,
      customerName: 'Test',
      customerPhone: '555',
      deliveryAddress: 'Address',
      courierId: 1,
      items: [{ menuItemId: 1, quantity: 1 }],
    });
    assert.equal(withinCapacity.status, 201);
    assert.equal(data<OrderResponse>(withinCapacity).courierId, 1);
    assert.equal(overCapacity.status, 409);
    assert.equal(errorCode(overCapacity), 'COURIER_AT_CAPACITY');
  });

  it('generates only distance-eligible batches and does not duplicate them', async () => {
    const nearbyOne = addOrder({ status: 'ready', zoneId: 1 });
    const nearbyTwo = addOrder({ status: 'ready', zoneId: 2 });
    addOrder({ status: 'ready', zoneId: 3 });
    const first = await request('/api/batches/generate', 'POST', {});
    const repeated = await request('/api/batches/generate', 'POST', {});
    assert.equal(first.status, 201);
    const generated = data<BatchResponse[]>(first);
    assert.equal(generated.length, 1);
    assert.deepEqual(
      generated[0].orders.map((order) => order.id).sort(),
      [nearbyOne, nearbyTwo].sort()
    );
    assert.ok(generated[0].distanceKm <= 2.5);
    assert.equal(repeated.status, 201);
    assert.deepEqual(data<unknown[]>(repeated), []);
  });

  it('returns an empty result when no Packed orders are eligible', async () => {
    const result = await request('/api/batches/generate', 'POST', {});
    assert.equal(result.status, 201);
    assert.deepEqual(data<unknown[]>(result), []);
  });

  it('calculates real-coordinate distances and rejects groups beyond the limit', async () => {
    const nearOne = addOrder({ status: 'ready', zoneId: null, latitude: 0, longitude: 0 });
    const nearTwo = addOrder({ status: 'ready', zoneId: null, latitude: 0, longitude: 0.001 });
    const created = await request('/api/batches', 'POST', { orderIds: [nearOne, nearTwo] });
    assert.equal(created.status, 201);
    const createdBatch = data<BatchResponse>(created);
    assert.equal(createdBatch.distanceSource, 'actual');
    assert.ok(createdBatch.distanceKm > 0.1 && createdBatch.distanceKm < 0.12);

    const farOne = addOrder({ status: 'ready', zoneId: null, latitude: 0, longitude: 0 });
    const farTwo = addOrder({ status: 'ready', zoneId: null, latitude: 1, longitude: 1 });
    const rejected = await request('/api/batches', 'POST', { orderIds: [farOne, farTwo] });
    assert.equal(rejected.status, 400);
    assert.equal(errorCode(rejected), 'BATCH_DISTANCE_EXCEEDED');
  });

  it('rejects batches mixing actual and simulated distance sources', async () => {
    const actualOrder = addOrder({ status: 'ready', zoneId: 1, latitude: 10, longitude: 10 });
    const simulatedOrder = addOrder({ status: 'ready', zoneId: 1 });
    const result = await request('/api/batches', 'POST', {
      orderIds: [actualOrder, simulatedOrder],
    });
    assert.equal(result.status, 409);
    assert.equal(errorCode(result), 'MIXED_LOCATION_SOURCES');
  });

  it('rejects batch assignment when the courier lacks capacity for every order', async () => {
    const first = addOrder({ status: 'ready', zoneId: 1 });
    const second = addOrder({ status: 'ready', zoneId: 2 });
    const batch = await request('/api/batches', 'POST', { orderIds: [first, second] });
    const assignment = await request(
      `/api/batches/${data<BatchResponse>(batch).id}/assign-courier`,
      'PATCH',
      { courierId: 1 }
    );
    assert.equal(batch.status, 201);
    assert.equal(assignment.status, 409);
    assert.equal(errorCode(assignment), 'COURIER_AT_CAPACITY');
  });

  it('synchronizes order states when an assigned batch advances', async () => {
    const first = addOrder({ status: 'ready', zoneId: 1 });
    const second = addOrder({ status: 'ready', zoneId: 2 });
    const batch = await request('/api/batches', 'POST', { orderIds: [first, second] });
    const assigned = await request(
      `/api/batches/${data<BatchResponse>(batch).id}/assign-courier`,
      'PATCH',
      { courierId: 2 }
    );
    const started = await request(`/api/batches/${data<BatchResponse>(batch).id}/status`, 'PATCH', {
      status: 'in-progress',
    });
    const completed = await request(`/api/batches/${data<BatchResponse>(batch).id}/status`, 'PATCH', {
      status: 'completed',
    });
    assert.equal(assigned.status, 200);
    assert.equal(started.status, 200);
    assert.ok(data<BatchResponse>(started).orders.every((order) => order.status === 'Out for Delivery'));
    assert.equal(completed.status, 200);
    assert.ok(data<BatchResponse>(completed).orders.every((order) => order.status === 'Delivered'));
  });

  it('serves the OpenAPI contract and preserves existing read routes', async () => {
    const docs = await request('/api/openapi.json');
    const endpoints = [
      '/api/brands',
      '/api/orders',
      '/api/couriers',
      '/api/zones',
      '/api/batches',
    ];
    assert.equal(docs.status, 200);
    assert.equal(docs.body.openapi, '3.0.3');
    for (const endpoint of endpoints) {
      const result = await request(endpoint);
      assert.equal(result.status, 200, endpoint);
      assert.ok(Array.isArray(data<unknown[]>(result)), endpoint);
    }
  });
});
