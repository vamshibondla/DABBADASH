import { getDb } from './connection';
import { closeDb } from './connection';
import { createSchema } from './schema';
import { logger } from '../logger';

interface InsertBrand { name: string; cuisine_type: string; color: string }
interface InsertMenuItem { brand_id: number; name: string; description: string; price: number; category: string }
interface InsertZone { name: string; sector: string; area_coverage: string; base_delivery_fee: number }
interface InsertCourier { name: string; phone: string; vehicle_type: string; status: string; current_zone_id: number | null; deliveries_today: number; rating: number; earnings_today: number }
interface InsertOrder { order_ref: string; brand_id: number; customer_name: string; customer_phone: string; delivery_address: string; delivery_zone_id: number; courier_id: number | null; status: string; total_amount: number; prep_time_minutes: number; placed_at: string; kitchen_started_at?: string | null; kitchen_completed_at?: string | null }
interface InsertOrderItem { order_id: number; menu_item_id: number; quantity: number; unit_price: number; special_instructions?: string }

export function seedDatabase(): void {
  const db = getDb();

  const insertBrand = db.prepare<InsertBrand>(
    'INSERT INTO brands (name, cuisine_type, color) VALUES (@name, @cuisine_type, @color)'
  );
  const insertMenuItem = db.prepare<InsertMenuItem>(
    'INSERT INTO menu_items (brand_id, name, description, price, category) VALUES (@brand_id, @name, @description, @price, @category)'
  );
  const insertZone = db.prepare<InsertZone>(
    'INSERT INTO delivery_zones (name, sector, area_coverage, base_delivery_fee) VALUES (@name, @sector, @area_coverage, @base_delivery_fee)'
  );
  const insertCourier = db.prepare<InsertCourier>(
    'INSERT INTO couriers (name, phone, vehicle_type, status, current_zone_id, deliveries_today, rating, earnings_today) VALUES (@name, @phone, @vehicle_type, @status, @current_zone_id, @deliveries_today, @rating, @earnings_today)'
  );
  const insertOrder = db.prepare<InsertOrder>(
    'INSERT INTO orders (order_ref, brand_id, customer_name, customer_phone, delivery_address, delivery_zone_id, courier_id, status, total_amount, prep_time_minutes, placed_at, kitchen_started_at, kitchen_completed_at) VALUES (@order_ref, @brand_id, @customer_name, @customer_phone, @delivery_address, @delivery_zone_id, @courier_id, @status, @total_amount, @prep_time_minutes, @placed_at, @kitchen_started_at, @kitchen_completed_at)'
  );
  const insertOrderItem = db.prepare<InsertOrderItem>(
    'INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, special_instructions) VALUES (@order_id, @menu_item_id, @quantity, @unit_price, @special_instructions)'
  );

  const seed = db.transaction(() => {
    const tables = [
      'brands',
      'menu_items',
      'delivery_zones',
      'couriers',
      'orders',
      'order_items',
      'delivery_batches',
      'delivery_batch_orders',
    ];
    const hasExistingData = tables.some(
      (table) =>
        (db.prepare(`SELECT EXISTS(SELECT 1 FROM ${table} LIMIT 1) AS present`).get() as {
          present: number;
        }).present === 1
    );
    if (hasExistingData) {
      return false;
    }

    logger.info('Seeding empty database.', { event: 'demo_seed_started' });

    // ── BRANDS ────────────────────────────────────────────────────────────────
    const brands: InsertBrand[] = [
      { name: 'Biryani Box',  cuisine_type: 'Indian',  color: '#f97316' },
      { name: 'Burger Den',   cuisine_type: 'American', color: '#8b5cf6' },
      { name: 'Chai Point',   cuisine_type: 'Indian Beverages', color: '#22c55e' },
    ];
    brands.forEach(b => insertBrand.run(b));
    // brand IDs: 1=Biryani Box, 2=Burger Den, 3=Chai Point

    // ── MENU ITEMS (20 total) ─────────────────────────────────────────────────
    const menuItems: InsertMenuItem[] = [
      // Biryani Box — 7 items
      { brand_id: 1, name: 'Hyderabadi Chicken Biryani', description: 'Aromatic basmati rice slow-cooked with tender chicken, saffron & whole spices', price: 350, category: 'Biryani' },
      { brand_id: 1, name: 'Veg Dum Biryani',           description: 'Fragrant basmati with seasonal vegetables cooked in the dum style',            price: 280, category: 'Biryani' },
      { brand_id: 1, name: 'Mutton Biryani',             description: 'Melt-in-mouth mutton pieces layered with long-grain rice & crispy onions',      price: 420, category: 'Biryani' },
      { brand_id: 1, name: 'Chicken 65 Biryani',         description: 'Spicy Chicken 65 tossed into fluffy biryani — a crowd favourite',              price: 380, category: 'Biryani' },
      { brand_id: 1, name: 'Raita',                      description: 'Cool yoghurt with cucumber, coriander & roasted cumin',                        price: 60,  category: 'Sides' },
      { brand_id: 1, name: 'Haleem',                     description: 'Slow-cooked meat & lentil stew — rich, hearty, deeply spiced',                 price: 220, category: 'Starters' },
      { brand_id: 1, name: 'Gulab Jamun (2 pc)',         description: 'Soft milk-solid dumplings soaked in rose-flavoured sugar syrup',                price: 80,  category: 'Desserts' },
      // Burger Den — 7 items
      { brand_id: 2, name: 'Classic Beef Burger',         description: 'Juicy beef patty, lettuce, tomato, pickles & house sauce in a brioche bun',   price: 180, category: 'Burgers' },
      { brand_id: 2, name: 'Double Cheese Burger',        description: 'Double smashed patty, two slices of cheddar & caramelised onions',            price: 240, category: 'Burgers' },
      { brand_id: 2, name: 'Veggie Delight Burger',       description: 'Plant-based patty with avocado, rocket & chipotle mayo',                      price: 160, category: 'Burgers' },
      { brand_id: 2, name: 'Spicy Chicken Zinger',        description: 'Crispy spiced chicken fillet, coleslaw & sriracha glaze',                     price: 200, category: 'Burgers' },
      { brand_id: 2, name: 'Loaded Cheese Fries',         description: 'Golden fries smothered in cheese sauce, jalapeños & crispy bacon bits',       price: 120, category: 'Sides' },
      { brand_id: 2, name: 'Onion Rings (6 pc)',          description: 'Thick-cut onion rings in a beer batter, served with ranch dip',               price: 90,  category: 'Sides' },
      { brand_id: 2, name: 'Chocolate Milkshake',         description: 'Thick & creamy shake made with Belgian chocolate ice cream',                   price: 150, category: 'Beverages' },
      // Chai Point — 6 items
      { brand_id: 3, name: 'Masala Chai (500 ml)',        description: 'Freshly brewed loose-leaf tea with ginger, cardamom, cinnamon & cloves',      price: 60,  category: 'Chai' },
      { brand_id: 3, name: 'Premium Green Tea',           description: 'Single-estate Darjeeling green tea, served hot or iced',                      price: 50,  category: 'Chai' },
      { brand_id: 3, name: 'Cutting Chai (200 ml)',       description: 'Strong, concentrated Mumbai-style cutting chai — the real deal',               price: 25,  category: 'Chai' },
      { brand_id: 3, name: 'Veg Samosa (2 pc)',           description: 'Crispy golden pastry filled with spiced potato & peas',                        price: 40,  category: 'Snacks' },
      { brand_id: 3, name: 'Vada Pav',                    description: "Mumbai's favourite street snack — spiced potato fritter in a soft bun",       price: 55,  category: 'Snacks' },
      { brand_id: 3, name: 'Butter Biscuits (4 pc)',      description: 'Freshly baked, lightly sweet biscuits — the perfect chai companion',          price: 35,  category: 'Snacks' },
    ];
    menuItems.forEach(m => insertMenuItem.run(m));
    // item IDs 1-7=BiryaniBox, 8-14=BurgerDen, 15-20=ChaiPoint

    // ── DELIVERY ZONES (4) ────────────────────────────────────────────────────
    const zones: InsertZone[] = [
      { name: 'Sector A', sector: 'A', area_coverage: 'Andheri West, Versova, Juhu, DN Nagar', base_delivery_fee: 25 },
      { name: 'Sector B', sector: 'B', area_coverage: 'Bandra, Santacruz, Khar, Kalina',       base_delivery_fee: 30 },
      { name: 'Sector C', sector: 'C', area_coverage: 'Chembur, Powai, Ghatkopar, Thane',      base_delivery_fee: 35 },
      { name: 'Sector D', sector: 'D', area_coverage: 'Dadar, Malad, Goregaon, Borivali',      base_delivery_fee: 30 },
    ];
    zones.forEach(z => insertZone.run(z));
    // zone IDs: 1=A, 2=B, 3=C, 4=D

    // ── COURIERS (6) ─────────────────────────────────────────────────────────
    const couriers: InsertCourier[] = [
      { name: 'Rahul Mishra',  phone: '+91 98001 23456', vehicle_type: 'bike',    status: 'on-delivery', current_zone_id: 1, deliveries_today: 23, rating: 4.8, earnings_today: 1840 },
      { name: 'Suresh Kumar',  phone: '+91 97001 23456', vehicle_type: 'scooter', status: 'on-delivery', current_zone_id: 2, deliveries_today: 19, rating: 4.6, earnings_today: 1520 },
      { name: 'Amit Dubey',    phone: '+91 96001 23456', vehicle_type: 'bike',    status: 'on-delivery', current_zone_id: 3, deliveries_today: 17, rating: 4.9, earnings_today: 1360 },
      { name: 'Vikram Singh',  phone: '+91 95001 23456', vehicle_type: 'scooter', status: 'available',   current_zone_id: null, deliveries_today: 21, rating: 4.7, earnings_today: 1680 },
      { name: 'Ravi Patil',    phone: '+91 94001 23456', vehicle_type: 'bicycle', status: 'on-delivery', current_zone_id: 4, deliveries_today: 15, rating: 4.5, earnings_today: 1200 },
      { name: 'Nitin Bhosle',  phone: '+91 93001 23456', vehicle_type: 'bike',    status: 'on-delivery', current_zone_id: 2,    deliveries_today: 28, rating: 4.9, earnings_today: 2240 },
    ];
    couriers.forEach(c => insertCourier.run(c));
    // courier IDs: 1=Rahul, 2=Suresh, 3=Amit, 4=Vikram, 5=Ravi, 6=Nitin

    // ── ORDERS (15) ───────────────────────────────────────────────────────────
    const now = new Date();
    const ago = (mins: number) => new Date(now.getTime() - mins * 60000).toISOString().replace('T', ' ').slice(0, 19);

    const orders: InsertOrder[] = [
      { order_ref: 'DD-3001', brand_id: 1, customer_name: 'Priya Sharma',   customer_phone: '+91 98765 43210', delivery_address: 'Flat 12, Andheri West', delivery_zone_id: 1, courier_id: 1,    status: 'preparing',  total_amount: 410,  prep_time_minutes: 25, placed_at: ago(30), kitchen_started_at: ago(25) },
      { order_ref: 'DD-3002', brand_id: 2, customer_name: 'Arjun Mehta',    customer_phone: '+91 87654 32109', delivery_address: '7B, Bandra East',       delivery_zone_id: 2, courier_id: null, status: 'ready',      total_amount: 360,  prep_time_minutes: 18, placed_at: ago(40), kitchen_started_at: ago(35), kitchen_completed_at: ago(17) },
      { order_ref: 'DD-3003', brand_id: 1, customer_name: 'Sneha Kapoor',   customer_phone: '+91 76543 21098', delivery_address: '22, Juhu Lane',          delivery_zone_id: 1, courier_id: null, status: 'pending',    total_amount: 480,  prep_time_minutes: 30, placed_at: ago(1) },
      { order_ref: 'DD-3004', brand_id: 3, customer_name: 'Rohit Verma',    customer_phone: '+91 65432 10987', delivery_address: '5, Powai Heights',       delivery_zone_id: 3, courier_id: 3,    status: 'dispatched', total_amount: 215,  prep_time_minutes: 12, placed_at: ago(65), kitchen_started_at: ago(60), kitchen_completed_at: ago(48) },
      { order_ref: 'DD-3005', brand_id: 2, customer_name: 'Anjali Nair',    customer_phone: '+91 54321 09876', delivery_address: '18, Malad West',          delivery_zone_id: 4, courier_id: null, status: 'pending',    total_amount: 520,  prep_time_minutes: 20, placed_at: ago(3) },
      { order_ref: 'DD-3006', brand_id: 3, customer_name: 'Kunal Desai',    customer_phone: '+91 43210 98765', delivery_address: '9, Goregaon East',       delivery_zone_id: 4, courier_id: 5,    status: 'preparing',  total_amount: 230,  prep_time_minutes: 15, placed_at: ago(30), kitchen_started_at: ago(25) },
      { order_ref: 'DD-3007', brand_id: 1, customer_name: 'Meera Joshi',    customer_phone: '+91 32109 87654', delivery_address: '33, Versova',             delivery_zone_id: 1, courier_id: 1,    status: 'dispatched', total_amount: 500,  prep_time_minutes: 28, placed_at: ago(70), kitchen_started_at: ago(65), kitchen_completed_at: ago(37) },
      { order_ref: 'DD-3008', brand_id: 2, customer_name: 'Siddharth Rao',  customer_phone: '+91 21098 76543', delivery_address: '11, Lokhandwala',         delivery_zone_id: 1, courier_id: 6,    status: 'delivered',  total_amount: 450,  prep_time_minutes: 16, placed_at: ago(90), kitchen_started_at: ago(85), kitchen_completed_at: ago(69) },
      { order_ref: 'DD-3009', brand_id: 3, customer_name: 'Pooja Pillai',   customer_phone: '+91 10987 65432', delivery_address: '6, Chembur Colony',       delivery_zone_id: 3, courier_id: null, status: 'cancelled',  total_amount: 140,  prep_time_minutes: 10, placed_at: ago(25) },
      { order_ref: 'DD-3010', brand_id: 1, customer_name: 'Tanmay Shah',    customer_phone: '+91 90876 54321', delivery_address: '27, Thane West',          delivery_zone_id: 3, courier_id: 4,    status: 'delivered',  total_amount: 340,  prep_time_minutes: 22, placed_at: ago(110), kitchen_started_at: ago(105), kitchen_completed_at: ago(83) },
      { order_ref: 'DD-3011', brand_id: 2, customer_name: 'Deepa Iyer',     customer_phone: '+91 80765 43210', delivery_address: '3, Kharghar',              delivery_zone_id: 3, courier_id: null, status: 'pending',    total_amount: 440,  prep_time_minutes: 20, placed_at: ago(4) },
      { order_ref: 'DD-3012', brand_id: 1, customer_name: 'Varun Chopra',   customer_phone: '+91 70654 32109', delivery_address: '14, Borivali East',       delivery_zone_id: 4, courier_id: 2,    status: 'preparing',  total_amount: 570,  prep_time_minutes: 25, placed_at: ago(30), kitchen_started_at: ago(25) },
      { order_ref: 'DD-3013', brand_id: 3, customer_name: 'Nisha Agarwal',  customer_phone: '+91 60543 21098', delivery_address: '8, Andheri East',         delivery_zone_id: 1, courier_id: null, status: 'ready',      total_amount: 190,  prep_time_minutes: 12, placed_at: ago(45), kitchen_started_at: ago(40), kitchen_completed_at: ago(28) },
      { order_ref: 'DD-3014', brand_id: 2, customer_name: 'Kartik Bhatt',   customer_phone: '+91 50432 10987', delivery_address: '19, Santacruz',           delivery_zone_id: 2, courier_id: 6,    status: 'dispatched', total_amount: 420,  prep_time_minutes: 18, placed_at: ago(80), kitchen_started_at: ago(75), kitchen_completed_at: ago(57) },
      { order_ref: 'DD-3015', brand_id: 1, customer_name: 'Ritika Sinha',   customer_phone: '+91 40321 09876', delivery_address: '25, Dadar',               delivery_zone_id: 4, courier_id: null, status: 'pending',    total_amount: 640,  prep_time_minutes: 30, placed_at: ago(2) },
    ];

    orders.forEach(o => {
      if (o.kitchen_started_at === undefined) o.kitchen_started_at = null;
      if (o.kitchen_completed_at === undefined) o.kitchen_completed_at = null;
      const result = insertOrder.run(o) as { lastInsertRowid: number };
      const orderId = result.lastInsertRowid;

      // Map order items by order_ref
      const itemMap: Record<string, InsertOrderItem[]> = {
        'DD-3001': [{ order_id: orderId, menu_item_id: 1, quantity: 1, unit_price: 350, special_instructions: '' }, { order_id: orderId, menu_item_id: 5, quantity: 1, unit_price: 60, special_instructions: '' }],
        'DD-3002': [{ order_id: orderId, menu_item_id: 9, quantity: 1, unit_price: 240, special_instructions: '' }, { order_id: orderId, menu_item_id: 12, quantity: 1, unit_price: 120, special_instructions: '' }],
        'DD-3003': [{ order_id: orderId, menu_item_id: 3, quantity: 1, unit_price: 420, special_instructions: '' }, { order_id: orderId, menu_item_id: 5, quantity: 1, unit_price: 60, special_instructions: '' }],
        'DD-3004': [{ order_id: orderId, menu_item_id: 15, quantity: 2, unit_price: 60, special_instructions: '' }, { order_id: orderId, menu_item_id: 18, quantity: 1, unit_price: 40, special_instructions: '' }, { order_id: orderId, menu_item_id: 19, quantity: 1, unit_price: 55, special_instructions: '' }],
        'DD-3005': [{ order_id: orderId, menu_item_id: 11, quantity: 2, unit_price: 200, special_instructions: '' }, { order_id: orderId, menu_item_id: 12, quantity: 1, unit_price: 120, special_instructions: '' }],
        'DD-3006': [{ order_id: orderId, menu_item_id: 15, quantity: 2, unit_price: 60, special_instructions: '' }, { order_id: orderId, menu_item_id: 19, quantity: 2, unit_price: 55, special_instructions: '' }],
        'DD-3007': [{ order_id: orderId, menu_item_id: 4, quantity: 1, unit_price: 380, special_instructions: '' }, { order_id: orderId, menu_item_id: 5, quantity: 2, unit_price: 60, special_instructions: '' }],
        'DD-3008': [{ order_id: orderId, menu_item_id: 8, quantity: 2, unit_price: 180, special_instructions: '' }, { order_id: orderId, menu_item_id: 13, quantity: 1, unit_price: 90, special_instructions: '' }],
        'DD-3009': [{ order_id: orderId, menu_item_id: 17, quantity: 4, unit_price: 25, special_instructions: '' }, { order_id: orderId, menu_item_id: 18, quantity: 1, unit_price: 40, special_instructions: '' }],
        'DD-3010': [{ order_id: orderId, menu_item_id: 2, quantity: 1, unit_price: 280, special_instructions: '' }, { order_id: orderId, menu_item_id: 5, quantity: 1, unit_price: 60, special_instructions: '' }],
        'DD-3011': [{ order_id: orderId, menu_item_id: 10, quantity: 2, unit_price: 160, special_instructions: '' }, { order_id: orderId, menu_item_id: 12, quantity: 1, unit_price: 120, special_instructions: '' }],
        'DD-3012': [{ order_id: orderId, menu_item_id: 1, quantity: 1, unit_price: 350, special_instructions: '' }, { order_id: orderId, menu_item_id: 6, quantity: 1, unit_price: 220, special_instructions: '' }],
        'DD-3013': [{ order_id: orderId, menu_item_id: 15, quantity: 2, unit_price: 60, special_instructions: '' }, { order_id: orderId, menu_item_id: 20, quantity: 2, unit_price: 35, special_instructions: '' }],
        'DD-3014': [{ order_id: orderId, menu_item_id: 8, quantity: 1, unit_price: 180, special_instructions: '' }, { order_id: orderId, menu_item_id: 9, quantity: 1, unit_price: 240, special_instructions: '' }],
        'DD-3015': [{ order_id: orderId, menu_item_id: 3, quantity: 1, unit_price: 420, special_instructions: '' }, { order_id: orderId, menu_item_id: 7, quantity: 2, unit_price: 80, special_instructions: 'Extra syrup please' }, { order_id: orderId, menu_item_id: 5, quantity: 1, unit_price: 60, special_instructions: '' }],
      };

      const items = itemMap[o.order_ref] ?? [];
      items.forEach(item => insertOrderItem.run(item));
    });

    db.prepare(
      `INSERT INTO app_metadata (key, value) VALUES ('demo_data_seeded', 'true')
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run();
    return true;
  });

  if (seed()) {
    logger.info('Demo data seed complete.', {
      event: 'demo_seed_completed',
      brands: 3,
      menuItems: 20,
      orders: 15,
      couriers: 6,
      zones: 4,
    });
  } else {
    logger.info('Database contains records; seed skipped to preserve existing data.', {
      event: 'demo_seed_skipped',
    });
  }
}

export function hasDemoSeedData(): boolean {
  const marker = getDb()
    .prepare("SELECT value FROM app_metadata WHERE key = 'demo_data_seeded'")
    .get() as { value: string } | undefined;
  return marker?.value === 'true';
}

if (require.main === module) {
  try {
    createSchema();
    seedDatabase();
  } catch (error) {
    logger.error('Database seeding failed.', {
      event: 'demo_seed_failed',
      errorType: error instanceof Error ? error.name : 'UnknownError',
    });
    process.exitCode = 1;
  } finally {
    closeDb();
  }
}
