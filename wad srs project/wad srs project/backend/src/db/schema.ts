import { getDb } from './connection';

export function createSchema(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_metadata (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS brands (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL UNIQUE,
      cuisine_type  TEXT    NOT NULL,
      color         TEXT    NOT NULL DEFAULT '#6b7280',
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_id      INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
      name          TEXT    NOT NULL,
      description   TEXT    NOT NULL DEFAULT '',
      price         REAL    NOT NULL,
      category      TEXT    NOT NULL,
      is_available  INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS delivery_zones (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      name              TEXT NOT NULL,
      sector            TEXT NOT NULL UNIQUE,
      area_coverage     TEXT NOT NULL,
      base_delivery_fee REAL NOT NULL DEFAULT 25,
      created_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS couriers (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      name             TEXT NOT NULL,
      phone            TEXT NOT NULL UNIQUE,
      vehicle_type     TEXT NOT NULL DEFAULT 'bike',
      status           TEXT NOT NULL DEFAULT 'available',
      current_zone_id  INTEGER REFERENCES delivery_zones(id),
      deliveries_today INTEGER NOT NULL DEFAULT 0,
      max_active_orders INTEGER NOT NULL DEFAULT 3 CHECK(max_active_orders > 0),
      rating           REAL    NOT NULL DEFAULT 5.0,
      earnings_today   REAL    NOT NULL DEFAULT 0,
      created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      order_ref          TEXT    NOT NULL UNIQUE,
      brand_id           INTEGER NOT NULL REFERENCES brands(id),
      customer_name      TEXT    NOT NULL,
      customer_phone     TEXT    NOT NULL,
      delivery_address   TEXT    NOT NULL,
      delivery_zone_id   INTEGER REFERENCES delivery_zones(id),
      delivery_latitude  REAL,
      delivery_longitude REAL,
      kitchen_started_at TEXT,
      kitchen_completed_at TEXT,
      courier_id         INTEGER REFERENCES couriers(id),
      status             TEXT    NOT NULL DEFAULT 'pending',
      total_amount       REAL    NOT NULL,
      prep_time_minutes  INTEGER NOT NULL DEFAULT 20,
      placed_at          TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id             INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      menu_item_id         INTEGER NOT NULL REFERENCES menu_items(id),
      quantity             INTEGER NOT NULL DEFAULT 1,
      unit_price           REAL    NOT NULL,
      special_instructions TEXT    NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS delivery_batches (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_ref             TEXT    NOT NULL UNIQUE,
      delivery_zone_id      INTEGER REFERENCES delivery_zones(id),
      courier_id            INTEGER REFERENCES couriers(id),
      status                TEXT    NOT NULL DEFAULT 'pending'
                                    CHECK(status IN ('pending', 'assigned', 'in-progress', 'completed', 'cancelled')),
      distance_km           REAL    NOT NULL CHECK(distance_km >= 0),
      distance_source       TEXT    NOT NULL CHECK(distance_source IN ('actual', 'simulated')),
      created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS delivery_batch_orders (
      batch_id INTEGER NOT NULL REFERENCES delivery_batches(id) ON DELETE CASCADE,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      PRIMARY KEY (batch_id, order_id),
      UNIQUE (order_id)
    );

    CREATE INDEX IF NOT EXISTS idx_orders_status       ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_brand        ON orders(brand_id);
    CREATE INDEX IF NOT EXISTS idx_orders_courier      ON orders(courier_id);
    CREATE INDEX IF NOT EXISTS idx_delivery_batches_status ON delivery_batches(status);
    CREATE INDEX IF NOT EXISTS idx_delivery_batch_orders_order ON delivery_batch_orders(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_order   ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_menu_items_brand    ON menu_items(brand_id);
    CREATE INDEX IF NOT EXISTS idx_couriers_status     ON couriers(status);
  `);

  const courierColumns = db.prepare('PRAGMA table_info(couriers)').all() as Array<{ name: string }>;
  if (!courierColumns.some((column) => column.name === 'max_active_orders')) {
    db.exec(
      'ALTER TABLE couriers ADD COLUMN max_active_orders INTEGER NOT NULL DEFAULT 3 CHECK(max_active_orders > 0)'
    );
  }

  const orderColumns = db.prepare('PRAGMA table_info(orders)').all() as Array<{ name: string }>;
  if (!orderColumns.some((column) => column.name === 'delivery_latitude')) {
    db.exec('ALTER TABLE orders ADD COLUMN delivery_latitude REAL');
  }
  if (!orderColumns.some((column) => column.name === 'delivery_longitude')) {
    db.exec('ALTER TABLE orders ADD COLUMN delivery_longitude REAL');
  }
  if (!orderColumns.some((column) => column.name === 'kitchen_started_at')) {
    db.exec('ALTER TABLE orders ADD COLUMN kitchen_started_at TEXT');
  }
  if (!orderColumns.some((column) => column.name === 'kitchen_completed_at')) {
    db.exec('ALTER TABLE orders ADD COLUMN kitchen_completed_at TEXT');
  }
}
