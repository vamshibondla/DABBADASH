import { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Bike, Star, Package, MapPin, Phone } from 'lucide-react';
import type { Rider } from '../types';
import { useApiData } from '../contexts/ApiDataContext';
import { ApiFeedback } from '../components/ui/ApiFeedback';
import type { ApiCourierRecommendation } from '../services/api';

const statusConfig: Record<Rider['status'], { label: string; dot: string; badge: string }> = {
  'available':   { label: 'Available',   dot: 'bg-emerald-400', badge: 'bg-emerald-100 text-emerald-700' },
  'on-delivery': { label: 'On Delivery', dot: 'bg-orange-400',  badge: 'bg-orange-100 text-orange-700' },
  'offline':     { label: 'Offline',     dot: 'bg-slate-300',   badge: 'bg-slate-100 text-slate-500' },
};

const vehicleIcon: Record<Rider['vehicle'], string> = {
  bike:     '🏍️',
  bicycle:  '🚲',
  scooter:  '🛵',
};

export function RiderDispatch() {
  const {
    couriers,
    orders,
    batches,
    liveCouriers,
    isLoading,
    error,
    refresh,
    getRecommendedCouriers,
    assignCourier,
    updateCourierStatus,
  } = useApiData();
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [recommendations, setRecommendations] = useState<ApiCourierRecommendation[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [busyCourierId, setBusyCourierId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const activeBatchedOrderIds = new Set(
    batches
      .filter((batch) => ['pending', 'assigned', 'in-progress'].includes(batch.status))
      .flatMap((batch) => batch.orders.map((order) => order.id))
  );
  const assignableOrders = orders.filter(
    (order) =>
      order.apiId !== undefined &&
      !activeBatchedOrderIds.has(order.apiId) &&
      !order.rider &&
      order.status !== 'delivered' &&
      order.status !== 'cancelled'
  );

  useEffect(() => {
    if (!assignableOrders.some((order) => order.apiId === selectedOrderId)) {
      setSelectedOrderId(assignableOrders[0]?.apiId ?? null);
    }
  }, [assignableOrders, selectedOrderId]);

  useEffect(() => {
    let active = true;
    setRecommendations([]);
    setRecommendationError(null);
    if (selectedOrderId === null) {
      setIsLoadingRecommendations(false);
      return () => {
        active = false;
      };
    }

    setIsLoadingRecommendations(true);
    void getRecommendedCouriers(selectedOrderId)
      .then((result) => {
        if (active) setRecommendations(result);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setRecommendationError(
            requestError instanceof Error ? requestError.message : 'Unable to load recommendations.'
          );
        }
      })
      .finally(() => {
        if (active) setIsLoadingRecommendations(false);
      });

    return () => {
      active = false;
    };
  }, [getRecommendedCouriers, selectedOrderId]);

  if (isLoading || error) {
    return <ApiFeedback isLoading={isLoading} error={error} onRetry={refresh} />;
  }

  const riders = couriers;
  const available = riders.filter((r) => r.status === 'available').length;
  const onDelivery = riders.filter((r) => r.status === 'on-delivery').length;
  const offline = riders.filter((r) => r.status === 'offline').length;
  const selectedOrder = orders.find((order) => order.apiId === selectedOrderId);
  const recommendationById = new Map(
    recommendations.map((recommendation, index) => [recommendation.id, { recommendation, rank: index + 1 }])
  );

  async function handleAssign(rider: Rider) {
    if (selectedOrderId === null || rider.apiId === undefined) return;
    setBusyCourierId(rider.apiId);
    setActionError(null);
    setActionMessage(null);
    try {
      const { order, courier } = await assignCourier(selectedOrderId, rider.apiId);
      setActionMessage(`${courier.name} assigned to ${order.orderRef}.`);
    } catch (requestError) {
      setActionError(
        requestError instanceof Error ? requestError.message : 'Unable to assign this courier.'
      );
    } finally {
      setBusyCourierId(null);
    }
  }

  async function handleStatusChange(rider: Rider, status: Rider['status']) {
    if (rider.apiId === undefined) return;
    setBusyCourierId(rider.apiId);
    setActionError(null);
    setActionMessage(null);
    try {
      const updated = await updateCourierStatus(rider.apiId, status);
      setActionMessage(`${updated.name} is now ${updated.status.replace('-', ' ')}.`);
    } catch (requestError) {
      setActionError(
        requestError instanceof Error ? requestError.message : 'Unable to update courier status.'
      );
    } finally {
      setBusyCourierId(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Available', value: available, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
          { label: 'On Delivery', value: onDelivery, color: 'text-orange-500', bg: 'bg-orange-50 border-orange-200' },
          { label: 'Offline', value: offline, color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`rounded-2xl border p-4 ${bg}`}>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="dispatch-order" className="text-xs font-semibold text-slate-700">
            Order to assign
          </label>
          <select
            id="dispatch-order"
            value={selectedOrderId ?? ''}
            onChange={(event) => {
              setSelectedOrderId(event.target.value ? Number(event.target.value) : null);
              setActionError(null);
              setActionMessage(null);
            }}
            className="min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          >
            {assignableOrders.length === 0 && <option value="">No unbatched, unassigned active orders</option>}
            {assignableOrders.map((order) => (
              <option key={order.apiId} value={order.apiId}>
                {order.id} · {order.customer} · {order.area}
              </option>
            ))}
          </select>
          {selectedOrder && (
            <p className="text-xs text-slate-500">
              Delivery zone: <span className="font-semibold text-slate-700">{selectedOrder.area}</span>
            </p>
          )}
        </div>
        {selectedOrder && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold text-slate-600">Recommended couriers</p>
            {isLoadingRecommendations ? (
              <p className="mt-1 text-xs text-slate-400">Finding available couriers…</p>
            ) : recommendationError ? (
              <p className="mt-1 text-xs text-red-600">{recommendationError}</p>
            ) : recommendations.length === 0 ? (
              <p className="mt-1 text-xs text-slate-400">
                No available couriers have capacity for this order.
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">
                {recommendations
                  .slice(0, 3)
                  .map((courier) => `${courier.name} (${courier.activeOrders}/${courier.maxActiveOrders})`)
                  .join(' · ')}
              </p>
            )}
          </div>
        )}
        {(actionMessage || actionError) && (
          <p
            role={actionError ? 'alert' : 'status'}
            className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${
              actionError
                ? 'border border-red-200 bg-red-50 text-red-700'
                : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            {actionError ?? actionMessage}
          </p>
        )}
      </Card>

      {/* Rider cards */}
      {riders.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">
          No courier records are available.
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {riders.map((rider) => {
            const cfg = statusConfig[rider.status];
            const courier = liveCouriers.find((candidate) => candidate.id === rider.apiId);
            const recommendation = rider.apiId === undefined
              ? undefined
              : recommendationById.get(rider.apiId);
            return (
              <Card key={rider.id} hover>
              <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-orange-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {rider.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{rider.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="text-lg">{vehicleIcon[rider.vehicle]}</span>
                </div>

                {/* Stats */}
                <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="text-center bg-slate-50 rounded-lg py-2">
                    <p className="text-sm font-bold text-slate-900">{rider.deliveries}</p>
                    <p className="text-[10px] text-slate-400">Deliveries</p>
                  </div>
                  <div className="text-center bg-slate-50 rounded-lg py-2">
                    <div className="flex items-center justify-center gap-0.5">
                      <Star size={11} className="text-amber-400 fill-amber-400" />
                      <p className="text-sm font-bold text-slate-900">{rider.rating}</p>
                    </div>
                    <p className="text-[10px] text-slate-400">Rating</p>
                  </div>
                  <div className="text-center bg-slate-50 rounded-lg py-2">
                    <p className="text-sm font-bold text-slate-900">
                      {courier ? `₹${courier.earningsToday.toLocaleString('en-IN')}` : '—'}
                    </p>
                    <p className="text-[10px] text-slate-400">Earnings today</p>
                  </div>
                  <div className="text-center bg-slate-50 rounded-lg py-2">
                    <p className="text-sm font-bold text-slate-900">
                      {rider.activeOrders ?? 0}/{rider.maxActiveOrders ?? 0}
                    </p>
                    <p className="text-[10px] text-slate-400">Active orders</p>
                  </div>
                </div>

                {/* Info */}
                <div className="space-y-1.5 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <MapPin size={12} className="text-slate-400 flex-shrink-0" />
                    <span>{rider.area}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={12} className="text-slate-400 flex-shrink-0" />
                    <span>{rider.phone}</span>
                  </div>
                  {recommendation && (
                    <div className="rounded-lg bg-violet-50 px-2.5 py-2 text-[11px] text-violet-700">
                      <p className="font-semibold">Recommended #{recommendation.rank}</p>
                      <p>
                        {recommendation.recommendation.sameZone
                          ? 'Same delivery zone'
                          : 'Other delivery zone'}
                        {' · '}
                        {recommendation.recommendation.activeOrders}/
                        {recommendation.recommendation.maxActiveOrders} active orders
                      </p>
                    </div>
                  )}
                  {rider.currentOrder && (
                    <div className="flex items-center gap-2">
                      <Package size={12} className="text-violet-500 flex-shrink-0" />
                      <span className="font-semibold text-violet-600">{rider.currentOrder}</span>
                    </div>
                  )}
                </div>

                {/* Action */}
                <div className="mt-3 flex gap-2">
                  <select
                    aria-label={`Update ${rider.name} availability`}
                    value={rider.status}
                    disabled={busyCourierId === rider.apiId}
                    onChange={(event) =>
                      void handleStatusChange(rider, event.target.value as Rider['status'])
                    }
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50"
                  >
                    <option value="available">Available</option>
                    <option value="on-delivery">On Delivery</option>
                    <option value="offline">Offline</option>
                  </select>
                  {recommendation && selectedOrder && (
                    <button
                      type="button"
                      disabled={busyCourierId === rider.apiId}
                      onClick={() => void handleAssign(rider)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Bike size={13} />
                      {busyCourierId === rider.apiId ? 'Assigning…' : 'Assign Order'}
                    </button>
                  )}
                </div>
              </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
