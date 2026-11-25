import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Order, OrderStatus, Rider } from '../types';
import { api, ApiUnavailableError } from '../services/api';
import { offlineDemoData } from '../data/offlineDemoData';
import type {
  ApiBrand,
  ApiCourier,
  ApiCourierAssignment,
  ApiCourierRecommendation,
  ApiDeliveryBatch,
  ApiDeliveryBatchStatus,
  ApiDeliveryZone,
  ApiOrder,
  ApiOrderStatus,
} from '../services/api';

interface ApiData {
  brands: ApiBrand[];
  orders: Order[];
  couriers: Rider[];
  zones: ApiDeliveryZone[];
  batches: ApiDeliveryBatch[];
  liveOrders: ApiOrder[];
  liveCouriers: ApiCourier[];
  isLoading: boolean;
  error: string | null;
  liveUpdateError: string | null;
  isDemoData: boolean;
  isOfflineDemo: boolean;
  refresh: () => Promise<void>;
  getRecommendedCouriers: (orderId: number) => Promise<ApiCourierRecommendation[]>;
  assignCourier: (orderId: number, courierId: number) => Promise<ApiCourierAssignment>;
  updateCourierStatus: (courierId: number, status: ApiCourier['status']) => Promise<ApiCourier>;
  generateDeliveryBatches: () => Promise<ApiDeliveryBatch[]>;
  assignBatchCourier: (batchId: number, courierId: number) => Promise<ApiDeliveryBatch>;
  updateDeliveryBatchStatus: (
    batchId: number,
    status: ApiDeliveryBatchStatus
  ) => Promise<ApiDeliveryBatch>;
  updateOrderStatus: (
    orderId: number,
    status: Exclude<ApiOrderStatus, 'Cancelled'>
  ) => Promise<Order>;
}

const ApiDataContext = createContext<ApiData | null>(null);

const uiStatusByApiStatus: Record<ApiOrderStatus, OrderStatus> = {
  Received: 'pending',
  'In Kitchen': 'preparing',
  Packed: 'ready',
  'Out for Delivery': 'dispatched',
  Delivered: 'delivered',
  Cancelled: 'cancelled',
};

function formatRelativeTime(value: string): string {
  const isoValue = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value;
  const timestamp = new Date(isoValue).getTime();
  if (!Number.isFinite(timestamp)) return value;
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(timestamp).toLocaleDateString();
}

function toUiOrder(order: ApiOrder): Order {
  return {
    apiId: order.id,
    brandId: order.brandId,
    id: order.orderRef,
    customer: order.customerName,
    phone: order.customerPhone,
    brand: order.brandName,
    items: order.items.map((item) =>
      item.quantity > 1 ? `${item.menuItemName} x${item.quantity}` : item.menuItemName
    ),
    total: order.totalAmount,
    status: uiStatusByApiStatus[order.status],
    time: formatRelativeTime(order.placedAt),
    prepTime: order.prepTimeMinutes,
    rider: order.courierName ?? undefined,
    address: order.deliveryAddress,
    area: order.deliveryZoneName ?? 'Unassigned',
  };
}

function toUiCourier(courier: ApiCourier, orders: ApiOrder[]): Rider {
  const activeOrder = orders.find(
    (order) =>
      order.courierId === courier.id &&
      order.status !== 'Delivered' &&
      order.status !== 'Cancelled'
  );
  return {
    apiId: courier.id,
    id: `R-${String(courier.id).padStart(2, '0')}`,
    name: courier.name,
    phone: courier.phone,
    status: courier.status,
    currentOrder: activeOrder?.orderRef,
    deliveries: courier.deliveriesToday,
    activeOrders: courier.activeOrders,
    maxActiveOrders: courier.maxActiveOrders,
    rating: courier.rating,
    area: courier.currentZoneName ?? 'Unassigned',
    vehicle: courier.vehicleType,
  };
}

export function ApiDataProvider({ children }: { children: ReactNode }) {
  const [brands, setBrands] = useState<ApiBrand[]>([]);
  const [apiOrders, setApiOrders] = useState<ApiOrder[]>([]);
  const [apiCouriers, setApiCouriers] = useState<ApiCourier[]>([]);
  const [zones, setZones] = useState<ApiDeliveryZone[]>([]);
  const [batches, setBatches] = useState<ApiDeliveryBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveUpdateError, setLiveUpdateError] = useState<string | null>(null);
  const [isDemoData, setIsDemoData] = useState(false);
  const [isOfflineDemo, setIsOfflineDemo] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [health, nextBrands, nextOrders, nextCouriers, nextZones, nextBatches] = await Promise.all([
        api.getHealth(),
        api.getBrands(),
        api.getOrders(),
        api.getCouriers(),
        api.getDeliveryZones(),
        api.getDeliveryBatches(),
      ]);
      setBrands(nextBrands);
      setApiOrders(nextOrders);
      setApiCouriers(nextCouriers);
      setZones(nextZones);
      setBatches(nextBatches);
      setIsDemoData(health.demoData);
      setIsOfflineDemo(false);
      setLiveUpdateError(null);
    } catch (requestError) {
      if (requestError instanceof ApiUnavailableError) {
        setBrands(offlineDemoData.brands);
        setApiOrders(offlineDemoData.orders);
        setApiCouriers(offlineDemoData.couriers);
        setZones(offlineDemoData.zones);
        setBatches(offlineDemoData.batches);
        setIsDemoData(false);
        setIsOfflineDemo(true);
        setLiveUpdateError(null);
        setError(null);
        return;
      }
      const message =
        requestError instanceof Error ? requestError.message : 'Unable to load dashboard data.';
      setError(message);
      throw requestError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  const refreshLiveState = useCallback(async () => {
    try {
      const [health, nextBrands, nextOrders, nextCouriers, nextZones, nextBatches] = await Promise.all([
        api.getHealth(),
        api.getBrands(),
        api.getOrders(),
        api.getCouriers(),
        api.getDeliveryZones(),
        api.getDeliveryBatches(),
      ]);
      setBrands(nextBrands);
      setApiOrders(nextOrders);
      setApiCouriers(nextCouriers);
      setZones(nextZones);
      setBatches(nextBatches);
      setIsDemoData(health.demoData);
      setIsOfflineDemo(false);
      setLiveUpdateError(null);
    } catch (requestError) {
      if (requestError instanceof ApiUnavailableError && isOfflineDemo) return;
      setLiveUpdateError(
        requestError instanceof Error ? requestError.message : 'Unable to refresh live delivery data.'
      );
    }
  }, [isOfflineDemo]);

  useEffect(() => {
    let requestInFlight = false;
    const pollLiveState = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      await refreshLiveState();
      requestInFlight = false;
    };
    const intervalId = window.setInterval(() => {
      void pollLiveState();
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [refreshLiveState]);

  const updateOrderStatus = useCallback(
    async (
      orderId: number,
      status: Exclude<ApiOrderStatus, 'Cancelled'>
    ): Promise<Order> => {
      setError(null);
      try {
        const updatedOrder = await api.updateOrderStatus(orderId, status);
        setApiOrders((current) =>
          current.map((order) => (order.id === orderId ? updatedOrder : order))
        );
        return toUiOrder(updatedOrder);
      } catch (requestError) {
        const message =
          requestError instanceof Error ? requestError.message : 'Unable to update order status.';
        setError(message);
        throw requestError;
      }
    },
    []
  );

  const getRecommendedCouriers = useCallback(
    (orderId: number) => {
      if (!isOfflineDemo) return api.getRecommendedCouriers(orderId);
      const order = offlineDemoData.orders.find((candidate) => candidate.id === orderId);
      if (!order || order.courierId !== null || ['Delivered', 'Cancelled'].includes(order.status)) {
        return Promise.resolve([]);
      }
      return Promise.resolve(
        offlineDemoData.couriers
          .filter(
            (courier) =>
              courier.status === 'available' && courier.activeOrders < courier.maxActiveOrders
          )
          .map((courier) => ({
            ...courier,
            sameZone: courier.currentZoneId === order.deliveryZoneId,
          }))
          .sort(
            (left, right) =>
              Number(right.sameZone) - Number(left.sameZone) ||
              left.activeOrders / left.maxActiveOrders - right.activeOrders / right.maxActiveOrders ||
              right.rating - left.rating
          )
      );
    },
    [isOfflineDemo]
  );

  const assignCourier = useCallback(
    async (orderId: number, courierId: number) => {
      const assignment = await api.assignCourier(orderId, courierId);
      setApiOrders((current) =>
        current.map((order) => (order.id === assignment.order.id ? assignment.order : order))
      );
      setApiCouriers((current) =>
        current.map((courier) =>
          courier.id === assignment.courier.id ? assignment.courier : courier
        )
      );
      return assignment;
    },
    []
  );

  const updateCourierStatus = useCallback(
    async (courierId: number, status: ApiCourier['status']) => {
      const courier = await api.updateCourierStatus(courierId, status);
      setApiCouriers((current) =>
        current.map((existing) => (existing.id === courier.id ? courier : existing))
      );
      return courier;
    },
    []
  );

  const generateDeliveryBatches = useCallback(async () => {
    const generated = await api.generateDeliveryBatches();
    setBatches((current) => [...generated, ...current]);
    return generated;
  }, []);

  const assignBatchCourier = useCallback(async (batchId: number, courierId: number) => {
    const batch = await api.assignBatchCourier(batchId, courierId);
    setBatches((current) => current.map((existing) => (existing.id === batchId ? batch : existing)));
    setApiOrders((current) => {
      const assignedById = new Map(batch.orders.map((order) => [order.id, order]));
      return current.map((order) => assignedById.get(order.id) ?? order);
    });
    const assignedCourier = batch.courier;
    if (assignedCourier) {
      setApiCouriers((current) =>
        current.map((courier) =>
          courier.id === assignedCourier.id ? assignedCourier : courier
        )
      );
    }
    return batch;
  }, []);

  const updateDeliveryBatchStatus = useCallback(
    async (batchId: number, status: ApiDeliveryBatchStatus) => {
      const batch = await api.updateDeliveryBatchStatus(batchId, status);
      setBatches((current) => current.map((existing) => (existing.id === batchId ? batch : existing)));
      setApiOrders((current) => {
        const batchOrders = new Map(batch.orders.map((order) => [order.id, order]));
        return current.map((order) => batchOrders.get(order.id) ?? order);
      });
      const updatedCourier = batch.courier;
      if (updatedCourier) {
        setApiCouriers((current) =>
          current.map((courier) =>
            courier.id === updatedCourier.id ? updatedCourier : courier
          )
        );
      }
      return batch;
    },
    []
  );

  const value = useMemo<ApiData>(
    () => ({
      brands,
      orders: apiOrders.map(toUiOrder),
      couriers: apiCouriers.map((courier) => toUiCourier(courier, apiOrders)),
      zones,
      batches,
      liveOrders: apiOrders,
      liveCouriers: apiCouriers,
      isLoading,
      error,
      liveUpdateError,
      isDemoData,
      isOfflineDemo,
      refresh,
      getRecommendedCouriers,
      assignCourier,
      updateCourierStatus,
      updateOrderStatus,
      generateDeliveryBatches,
      assignBatchCourier,
      updateDeliveryBatchStatus,
    }),
    [
      apiCouriers,
      apiOrders,
      assignBatchCourier,
      assignCourier,
      brands,
      batches,
      error,
      generateDeliveryBatches,
      getRecommendedCouriers,
      isLoading,
      isDemoData,
      isOfflineDemo,
      liveUpdateError,
      refresh,
      updateCourierStatus,
      updateDeliveryBatchStatus,
      updateOrderStatus,
      zones,
    ]
  );

  return <ApiDataContext.Provider value={value}>{children}</ApiDataContext.Provider>;
}

export function useApiData(): ApiData {
  const context = useContext(ApiDataContext);
  if (!context) {
    throw new Error('useApiData must be used within an ApiDataProvider.');
  }
  return context;
}
