import { useEffect, useState } from 'react';
import { Bike, MapPin, Package, X } from 'lucide-react';
import { ApiFeedback } from '../components/ui/ApiFeedback';
import { useApiData } from '../contexts/ApiDataContext';
import type { ApiCourier, ApiDeliveryZone, ApiOrder } from '../services/api';

interface MapPoint {
  x: number;
  y: number;
}

type MapSelection = { kind: 'order' | 'courier'; id: number } | null;

const zoneAnchors: MapPoint[] = [
  { x: 65, y: 25 },
  { x: 42, y: 54 },
  { x: 76, y: 68 },
  { x: 23, y: 69 },
];

const activeOrderStatuses = new Set([
  'Received',
  'In Kitchen',
  'Packed',
  'Out for Delivery',
]);

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function zoneAnchor(zoneId: number | null, zones: ApiDeliveryZone[]): MapPoint {
  const index = zoneId === null ? -1 : zones.findIndex((zone) => zone.id === zoneId);
  return index < 0
    ? { x: 50, y: 48 }
    : zoneAnchors[index % zoneAnchors.length];
}

function orderPosition(order: ApiOrder, zones: ApiDeliveryZone[]): MapPoint {
  const anchor = zoneAnchor(order.deliveryZoneId, zones);
  const horizontalJitter = ((order.id * 17) % 7) - 3;
  const verticalJitter = ((order.id * 13) % 7) - 3;
  return {
    x: clamp(anchor.x + horizontalJitter * 1.8, 7, 93),
    y: clamp(anchor.y + verticalJitter * 1.5, 9, 91),
  };
}

function courierPosition(
  courier: ApiCourier,
  orders: ApiOrder[],
  zones: ApiDeliveryZone[],
  tick: number
): MapPoint {
  const destinationOrder = orders.find(
    (order) => order.courierId === courier.id && activeOrderStatuses.has(order.status)
  );
  const home = courier.currentZoneId === null
    ? {
        x: 14 + ((courier.id * 19) % 72),
        y: 15 + ((courier.id * 29) % 68),
      }
    : zoneAnchor(courier.currentZoneId, zones);

  if (!destinationOrder) {
    const phase = tick * 0.3 + courier.id;
    return {
      x: clamp(home.x + Math.sin(phase) * 2.4, 5, 95),
      y: clamp(home.y + Math.cos(phase) * 2.4, 7, 93),
    };
  }

  const destination = orderPosition(destinationOrder, zones);
  const cycle = ((tick * 0.04 + courier.id * 0.13) % 2 + 2) % 2;
  const progress = cycle <= 1 ? cycle : 2 - cycle;
  return {
    x: home.x + (destination.x - home.x) * progress,
    y: home.y + (destination.y - home.y) * progress,
  };
}

export function LiveMap() {
  const {
    liveOrders,
    liveCouriers,
    zones,
    isLoading,
    error,
    refresh,
  } = useApiData();
  const [tick, setTick] = useState(0);
  const [selection, setSelection] = useState<MapSelection>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((current) => current + 1), 2500);
    return () => window.clearInterval(timer);
  }, []);

  if (isLoading || error) {
    return <ApiFeedback isLoading={isLoading} error={error} onRetry={refresh} />;
  }

  const activeOrders = liveOrders.filter((order) => activeOrderStatuses.has(order.status));
  const visibleCouriers = liveCouriers.filter((courier) => courier.status !== 'offline');
  const pendingPickup = activeOrders.filter((order) =>
    ['Received', 'In Kitchen', 'Packed'].includes(order.status)
  ).length;
  const selectedOrder =
    selection?.kind === 'order'
      ? activeOrders.find((order) => order.id === selection.id)
      : undefined;
  const selectedCourier =
    selection?.kind === 'courier'
      ? visibleCouriers.find((courier) => courier.id === selection.id)
      : undefined;
  const selectedCourierOrder = selectedCourier
    ? activeOrders.find((order) => order.courierId === selectedCourier.id)
    : undefined;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: 'Active Couriers',
            value: visibleCouriers.length,
            color: 'text-orange-500',
            bg: 'bg-orange-50 border-orange-200',
          },
          {
            label: 'Live Orders',
            value: activeOrders.length,
            color: 'text-violet-600',
            bg: 'bg-violet-50 border-violet-200',
          },
          {
            label: 'Pending Pick-up',
            value: pendingPickup,
            color: 'text-amber-600',
            bg: 'bg-amber-50 border-amber-200',
          },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`rounded-2xl border p-4 ${bg}`}>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Live Map View</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulated demo positions · refreshed from the API every 5 seconds
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-orange-400 ring-2 ring-orange-200" />
              Courier
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-violet-500 ring-2 ring-violet-200" />
              Order
            </span>
          </div>
        </div>

        <div
          className="relative w-full overflow-hidden"
          style={{
            height: 'min(64vh, 560px)',
            minHeight: '380px',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          }}
          aria-label="Interactive simulated delivery map"
        >
          <svg
            className="absolute inset-0 w-full h-full opacity-10 pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern id="live-map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#94a3b8" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#live-map-grid)" />
          </svg>
          <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" aria-hidden="true">
            <line x1="0" y1="40%" x2="100%" y2="40%" stroke="#475569" strokeWidth="6" />
            <line x1="0" y1="70%" x2="100%" y2="70%" stroke="#475569" strokeWidth="4" />
            <line x1="30%" y1="0" x2="30%" y2="100%" stroke="#475569" strokeWidth="6" />
            <line x1="65%" y1="0" x2="65%" y2="100%" stroke="#475569" strokeWidth="4" />
            <line x1="50%" y1="40%" x2="65%" y2="70%" stroke="#334155" strokeWidth="3" />
          </svg>

          {zones.map((zone, index) => {
            const point = zoneAnchors[index % zoneAnchors.length];
            return (
              <div
                key={zone.id}
                className="absolute flex flex-col items-center pointer-events-none"
                style={{ left: `${point.x}%`, top: `${point.y}%`, transform: 'translate(-50%, -50%)' }}
              >
                <span className="absolute w-32 h-24 rounded-[50%] border border-dashed border-sky-300/25 bg-sky-300/[0.04]" />
                <span className="relative text-[10px] font-semibold text-slate-400 uppercase tracking-widest bg-slate-900/70 px-1.5 py-0.5 rounded">
                  {zone.name}
                </span>
                <span className="relative mt-0.5 max-w-36 text-center text-[8px] leading-tight text-slate-500">
                  {zone.areaCoverage}
                </span>
              </div>
            );
          })}

          {activeOrders.map((order) => {
            const point = orderPosition(order, zones);
            return (
              <button
                key={`order-${order.id}`}
                type="button"
                aria-label={`Order ${order.orderRef}, ${order.status}`}
                title={`${order.orderRef} · ${order.status}`}
                onClick={() => setSelection({ kind: 'order', id: order.id })}
                className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-lg"
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500 ring-2 ring-violet-200/70 shadow-lg shadow-violet-500/40">
                  <Package size={12} className="text-white" />
                </span>
                <span className="mt-1 whitespace-nowrap rounded bg-slate-900/85 px-1 text-[9px] font-bold text-violet-200">
                  {order.orderRef}
                </span>
              </button>
            );
          })}

          {visibleCouriers.map((courier) => {
            const point = courierPosition(courier, activeOrders, zones, tick);
            const assignedOrder = activeOrders.find((order) => order.courierId === courier.id);
            return (
              <button
                key={`courier-${courier.id}`}
                type="button"
                aria-label={`Courier ${courier.name}, ${courier.status}${assignedOrder ? `, order ${assignedOrder.orderRef}` : ''}; simulated position`}
                title={`${courier.name} · simulated position`}
                onClick={() => setSelection({ kind: 'courier', id: courier.id })}
                className="absolute z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-lg transition-[left,top] duration-700 ease-linear"
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full ring-2 shadow-lg ${
                    courier.status === 'on-delivery'
                      ? 'bg-orange-400 ring-orange-200/70 shadow-orange-500/40'
                      : 'bg-emerald-400 ring-emerald-200/70 shadow-emerald-500/40'
                  }`}
                >
                  <Bike size={14} className="text-white" />
                </span>
                <span className="mt-1 whitespace-nowrap rounded bg-slate-900/85 px-1 text-[9px] font-bold text-orange-200">
                  {courier.name.split(' ')[0]}
                </span>
              </button>
            );
          })}

          {activeOrders.length === 0 && visibleCouriers.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
              No active delivery orders or couriers to display.
            </div>
          )}

          <div className="absolute bottom-3 left-3 right-3 z-30 flex items-end justify-between gap-3">
            <div className="max-w-sm rounded-xl border border-slate-600/70 bg-slate-900/95 p-3 text-xs text-slate-200 shadow-lg">
              {selectedOrder ? (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-mono font-bold text-violet-300">{selectedOrder.orderRef}</span>
                    <button
                      type="button"
                      aria-label="Close map details"
                      onClick={() => setSelection(null)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <p className="mt-1">{selectedOrder.status} · {selectedOrder.deliveryAddress}</p>
                  <p className="mt-1 text-slate-400">
                    {selectedOrder.courierName
                      ? `Courier: ${selectedOrder.courierName}`
                      : 'No courier assigned'}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">Order marker location is simulated by delivery zone.</p>
                </>
              ) : selectedCourier ? (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-semibold text-orange-200">{selectedCourier.name}</span>
                    <button
                      type="button"
                      aria-label="Close map details"
                      onClick={() => setSelection(null)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <p className="mt-1 capitalize">{selectedCourier.status} · {selectedCourier.currentZoneName ?? 'Unassigned zone'}</p>
                  <p className="mt-1 text-slate-400">
                    {selectedCourierOrder
                      ? `Order: ${selectedCourierOrder.orderRef}`
                      : 'No active assigned order'}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">Courier movement is simulated for the demo.</p>
                </>
              ) : (
                <>
                  <p className="font-semibold">Demo map — not GPS</p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Zone circles are illustrative anchors, not delivery boundaries. Select a marker for details.
                  </p>
                </>
              )}
            </div>
            <span className="flex items-center gap-1 rounded-lg bg-slate-900/90 px-2 py-1 text-[10px] text-slate-400">
              <MapPin size={11} />
              Simulated positions
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
