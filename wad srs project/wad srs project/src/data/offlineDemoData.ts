import type {
  ApiBrand,
  ApiCourier,
  ApiDeliveryBatch,
  ApiDeliveryZone,
  ApiOrder,
} from '../services/api';

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const offlineDemoData: {
  brands: ApiBrand[];
  orders: ApiOrder[];
  couriers: ApiCourier[];
  zones: ApiDeliveryZone[];
  batches: ApiDeliveryBatch[];
} = (() => {
  const brands: ApiBrand[] = [
    { id: 1, name: 'Biryani Box', cuisineType: 'Indian', color: '#f97316', isActive: true, createdAt: minutesAgo(600) },
    { id: 2, name: 'Burger Den', cuisineType: 'American', color: '#8b5cf6', isActive: true, createdAt: minutesAgo(600) },
    { id: 3, name: 'Chai Point', cuisineType: 'Indian Beverages', color: '#22c55e', isActive: true, createdAt: minutesAgo(600) },
  ];
  const zones: ApiDeliveryZone[] = [
    { id: 1, name: 'Sector A', sector: 'A', areaCoverage: 'Andheri West, Versova, Juhu, DN Nagar', baseDeliveryFee: 25, activeOrders: 3, assignedCouriers: 1 },
    { id: 2, name: 'Sector B', sector: 'B', areaCoverage: 'Bandra, Santacruz, Khar, Kalina', baseDeliveryFee: 30, activeOrders: 2, assignedCouriers: 2 },
    { id: 3, name: 'Sector C', sector: 'C', areaCoverage: 'Chembur, Powai, Ghatkopar, Thane', baseDeliveryFee: 35, activeOrders: 1, assignedCouriers: 1 },
    { id: 4, name: 'Sector D', sector: 'D', areaCoverage: 'Dadar, Malad, Goregaon, Borivali', baseDeliveryFee: 30, activeOrders: 1, assignedCouriers: 1 },
  ];
  const item = (id: number, name: string, quantity: number, unitPrice: number) => ({
    id,
    menuItemId: id,
    menuItemName: name,
    quantity,
    unitPrice,
    specialInstructions: '',
  });
  const order = (
    id: number,
    orderRef: string,
    brandId: number,
    customerName: string,
    customerPhone: string,
    deliveryAddress: string,
    zoneId: number,
    courierId: number | null,
    status: ApiOrder['status'],
    totalAmount: number,
    prepTimeMinutes: number,
    placedMinutesAgo: number,
    kitchenStartedMinutesAgo: number | null,
    kitchenCompletedMinutesAgo: number | null,
    items: ApiOrder['items']
  ): ApiOrder => ({
    id,
    orderRef,
    brandId,
    brandName: brands[brandId - 1].name,
    brandColor: brands[brandId - 1].color,
    customerName,
    customerPhone,
    deliveryAddress,
    deliveryZoneId: zoneId,
    deliveryZoneName: zones[zoneId - 1].name,
    kitchenStartedAt: kitchenStartedMinutesAgo === null ? null : minutesAgo(kitchenStartedMinutesAgo),
    kitchenCompletedAt: kitchenCompletedMinutesAgo === null ? null : minutesAgo(kitchenCompletedMinutesAgo),
    courierId,
    courierName: courierId === null ? null : courierNames[courierId - 1],
    status,
    totalAmount,
    prepTimeMinutes,
    items,
    placedAt: minutesAgo(placedMinutesAgo),
    updatedAt: minutesAgo(1),
  });
  const courierNames = [
    'Rahul Mishra',
    'Suresh Kumar',
    'Amit Dubey',
    'Vikram Singh',
    'Ravi Patil',
    'Nitin Bhosle',
  ];
  const orders: ApiOrder[] = [
    order(1, 'DD-3001', 1, 'Priya Sharma', '+91 98765 43210', 'Flat 12, Andheri West', 1, 1, 'In Kitchen', 410, 25, 30, 25, null, [item(1, 'Hyderabadi Chicken Biryani', 1, 350), item(5, 'Raita', 1, 60)]),
    order(2, 'DD-3002', 2, 'Arjun Mehta', '+91 87654 32109', '7B, Bandra East', 2, null, 'Packed', 360, 18, 40, 35, 17, [item(9, 'Double Cheese Burger', 1, 240), item(12, 'Loaded Cheese Fries', 1, 120)]),
    order(3, 'DD-3003', 1, 'Sneha Kapoor', '+91 76543 21098', '22, Juhu Lane', 1, null, 'Received', 480, 30, 5, null, null, [item(3, 'Mutton Biryani', 1, 420), item(5, 'Raita', 1, 60)]),
    order(4, 'DD-3004', 3, 'Rohit Verma', '+91 65432 10987', '5, Powai Heights', 3, 3, 'Out for Delivery', 215, 12, 65, 60, 48, [item(15, 'Masala Chai (500 ml)', 2, 60), item(18, 'Veg Samosa (2 pc)', 1, 40), item(19, 'Vada Pav', 1, 55)]),
    order(8, 'DD-3008', 2, 'Siddharth Rao', '+91 21098 76543', '11, Lokhandwala', 1, 6, 'Delivered', 450, 16, 90, 85, 69, [item(8, 'Classic Beef Burger', 2, 180), item(13, 'Onion Rings (6 pc)', 1, 90)]),
    order(10, 'DD-3010', 1, 'Tanmay Shah', '+91 90876 54321', '27, Thane West', 3, 4, 'Delivered', 340, 22, 110, 105, 83, [item(2, 'Veg Dum Biryani', 1, 280), item(5, 'Raita', 1, 60)]),
    order(12, 'DD-3012', 1, 'Varun Chopra', '+91 70654 32109', '14, Borivali East', 4, 5, 'In Kitchen', 570, 25, 30, 25, null, [item(1, 'Hyderabadi Chicken Biryani', 1, 350), item(6, 'Haleem', 1, 220)]),
    order(13, 'DD-3013', 3, 'Nisha Agarwal', '+91 60543 21098', '8, Andheri East', 1, null, 'Packed', 190, 12, 45, 40, 28, [item(15, 'Masala Chai (500 ml)', 2, 60), item(20, 'Butter Biscuits (4 pc)', 2, 35)]),
    order(14, 'DD-3014', 2, 'Kartik Bhatt', '+91 50432 10987', '19, Santacruz', 2, 6, 'Out for Delivery', 420, 18, 80, 75, 57, [item(8, 'Classic Beef Burger', 1, 180), item(9, 'Double Cheese Burger', 1, 240)]),
  ];
  const couriers: ApiCourier[] = [
    { id: 1, name: courierNames[0], phone: '+91 98001 23456', vehicleType: 'bike', status: 'on-delivery', currentZoneId: 1, currentZoneName: 'Sector A', deliveriesToday: 23, activeOrders: 1, maxActiveOrders: 3, rating: 4.8, earningsToday: 1840 },
    { id: 2, name: courierNames[1], phone: '+91 97001 23456', vehicleType: 'scooter', status: 'available', currentZoneId: 2, currentZoneName: 'Sector B', deliveriesToday: 19, activeOrders: 0, maxActiveOrders: 3, rating: 4.6, earningsToday: 1520 },
    { id: 3, name: courierNames[2], phone: '+91 96001 23456', vehicleType: 'bike', status: 'on-delivery', currentZoneId: 3, currentZoneName: 'Sector C', deliveriesToday: 17, activeOrders: 1, maxActiveOrders: 3, rating: 4.9, earningsToday: 1360 },
    { id: 4, name: courierNames[3], phone: '+91 95001 23456', vehicleType: 'scooter', status: 'available', currentZoneId: null, currentZoneName: null, deliveriesToday: 21, activeOrders: 0, maxActiveOrders: 3, rating: 4.7, earningsToday: 1680 },
    { id: 5, name: courierNames[4], phone: '+91 94001 23456', vehicleType: 'bicycle', status: 'on-delivery', currentZoneId: 4, currentZoneName: 'Sector D', deliveriesToday: 15, activeOrders: 1, maxActiveOrders: 3, rating: 4.5, earningsToday: 1200 },
    { id: 6, name: courierNames[5], phone: '+91 93001 23456', vehicleType: 'bike', status: 'on-delivery', currentZoneId: 2, currentZoneName: 'Sector B', deliveriesToday: 28, activeOrders: 1, maxActiveOrders: 3, rating: 4.9, earningsToday: 2240 },
  ];
  const recommended = (courier: ApiCourier) => ({
    ...courier,
    sameZone: courier.currentZoneId === 1,
    projectedActiveOrders: courier.activeOrders + 2,
  });
  const batchOrders = orders.filter((candidate) => candidate.id === 2 || candidate.id === 13);
  const batches: ApiDeliveryBatch[] = [
    {
      id: 1,
      batchRef: 'B-DEMO-001',
      deliveryZoneId: 1,
      deliveryZoneName: 'Sector A',
      courierId: null,
      courierName: null,
      status: 'pending',
      distanceKm: 1.6,
      distanceSource: 'simulated',
      orderCount: batchOrders.length,
      orders: batchOrders,
      courier: null,
      recommendedCouriers: couriers.filter((candidate) => candidate.status === 'available').map(recommended),
      createdAt: minutesAgo(3),
      updatedAt: minutesAgo(3),
    },
  ];
  return { brands, orders, couriers, zones, batches };
})();
