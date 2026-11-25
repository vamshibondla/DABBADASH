import { StatusBadge } from '../components/ui/Badge';
import { Clock, Package, ArrowRight } from 'lucide-react';
import type { OrderStatus, Order } from '../types';
import { useState } from 'react';
import { useApiData } from '../contexts/ApiDataContext';
import { getApiStatus } from '../contexts/apiDataUtils';
import { ApiFeedback } from '../components/ui/ApiFeedback';

const columns: { status: OrderStatus; label: string; color: string; bg: string; border: string }[] = [
  { status: 'pending',    label: 'Pending',    color: 'text-amber-600',  bg: 'bg-amber-50',   border: 'border-amber-200' },
  { status: 'preparing',  label: 'Preparing',  color: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-200' },
  { status: 'ready',      label: 'Ready',      color: 'text-emerald-600',bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { status: 'dispatched', label: 'Dispatched', color: 'text-violet-600', bg: 'bg-violet-50',  border: 'border-violet-200' },
];

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'dispatched',
  dispatched: 'delivered',
};

const nextStatusLabel: Partial<Record<OrderStatus, string>> = {
  pending: 'Start preparing',
  preparing: 'Mark packed',
  ready: 'Dispatch order',
  dispatched: 'Mark delivered',
};

function OrderCard({
  order,
  isUpdating,
  activeBatchRef,
  onAdvance,
}: {
  order: Order;
  isUpdating: boolean;
  activeBatchRef?: string;
  onAdvance: (order: Order, status: OrderStatus) => void;
}) {
  const next = nextStatus[order.status];
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-default">
      <div className="flex items-start justify-between mb-2">
        <span className="font-mono text-xs font-bold text-violet-600">{order.id}</span>
        <StatusBadge status={order.status} />
      </div>
      <p className="text-xs font-semibold text-slate-800 mb-0.5">{order.customer}</p>
      <p className="text-[11px] text-slate-500 mb-2">{order.brand} · {order.area}</p>
      <p className="text-[11px] text-slate-400 mb-3 line-clamp-1">{order.items.join(', ')}</p>
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <span className="flex items-center gap-1 text-[11px] text-slate-500">
          <Clock size={11} /> {order.prepTime}m prep
        </span>
        <span className="text-xs font-semibold text-slate-900">₹{order.total}</span>
      </div>
      {order.rider && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
          <Package size={11} className="text-violet-500" />
          <span>Rider: <span className="font-medium text-slate-700">{order.rider}</span></span>
        </div>
      )}
      {activeBatchRef && (
        <p className="mt-2 rounded-lg bg-sky-50 px-2.5 py-2 text-[11px] text-sky-800">
          In batch <span className="font-semibold">{activeBatchRef}</span>. Manage delivery from Delivery Batching.
        </p>
      )}
      {next && (
        <button
          type="button"
          disabled={isUpdating || order.apiId === undefined || activeBatchRef !== undefined}
          onClick={() => onAdvance(order, next)}
          title={activeBatchRef ? 'Manage this order through its delivery batch.' : undefined}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[11px] font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUpdating ? 'Updating…' : activeBatchRef ? 'Manage batch delivery' : nextStatusLabel[order.status]}
          {!isUpdating && !activeBatchRef && <ArrowRight size={12} />}
        </button>
      )}
    </div>
  );
}

export function KitchenBoard() {
  const { orders, batches, isLoading, error, refresh, updateOrderStatus } = useApiData();
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const activeBatchByOrder = new Map(
    batches
      .filter((batch) => ['pending', 'assigned', 'in-progress'].includes(batch.status))
      .flatMap((batch) => batch.orders.map((order) => [order.orderRef, batch.batchRef] as const))
  );

  async function advanceOrder(order: Order, status: OrderStatus) {
    if (order.apiId === undefined) return;
    setUpdatingOrderId(order.apiId);
    try {
      await updateOrderStatus(order.apiId, getApiStatus(status));
    } catch {
      // The shared API error state renders the request failure.
    } finally {
      setUpdatingOrderId(null);
    }
  }

  if (isLoading || error) {
    return <ApiFeedback isLoading={isLoading} error={error} onRetry={refresh} />;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Live kanban view of all active kitchen orders.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {columns.map(({ status, label, color, bg, border }) => {
          const columnOrders = orders.filter((o) => o.status === status);
          return (
            <div key={status} className={`rounded-2xl border ${border} ${bg} p-4`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-sm font-bold ${color}`}>{label}</h3>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full bg-white border ${border} ${color}`}>
                  {columnOrders.length}
                </span>
              </div>
              <div className="space-y-3">
                {columnOrders.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">No orders</div>
                ) : (
                  columnOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      isUpdating={updatingOrderId === order.apiId}
                      activeBatchRef={activeBatchByOrder.get(order.id)}
                      onAdvance={advanceOrder}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
