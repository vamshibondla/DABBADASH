import type { BrandStat, Order, OrderStatus } from '../types';
import type { ApiBrand, ApiOrderStatus } from '../services/api';

const apiStatusByUiStatus: Partial<Record<OrderStatus, ApiOrderStatus>> = {
  pending: 'Received',
  preparing: 'In Kitchen',
  ready: 'Packed',
  dispatched: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export function getApiStatus(status: OrderStatus): Exclude<ApiOrderStatus, 'Cancelled'> {
  const apiStatus = apiStatusByUiStatus[status];
  if (!apiStatus || apiStatus === 'Cancelled') {
    throw new Error(`No API status transition is available for ${status}.`);
  }
  return apiStatus;
}

export function getBrandStats(orders: Order[], brands: ApiBrand[]): BrandStat[] {
  return brands.map((brand) => {
    const brandOrders = orders.filter((order) => order.brandId === brand.id);
    return {
      name: brand.name,
      orders: brandOrders.length,
      revenue: brandOrders.reduce((total, order) => total + order.total, 0),
      color: brand.color,
    };
  });
}
