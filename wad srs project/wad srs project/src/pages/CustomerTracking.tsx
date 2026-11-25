import { useState } from 'react';
import { Search, CheckCircle2, Clock, Bike, ChefHat, Package } from 'lucide-react';
import { StatusBadge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import type { Order } from '../types';
import { useApiData } from '../contexts/ApiDataContext';
import { ApiFeedback } from '../components/ui/ApiFeedback';

const timeline: { status: Order['status']; label: string; icon: React.ElementType }[] = [
  { status: 'pending',    label: 'Order Placed',    icon: Package },
  { status: 'preparing',  label: 'Preparing',       icon: ChefHat },
  { status: 'ready',      label: 'Ready for Pickup',icon: CheckCircle2 },
  { status: 'dispatched', label: 'On the Way',      icon: Bike },
  { status: 'delivered',  label: 'Delivered',       icon: CheckCircle2 },
];

const statusOrder: Order['status'][] = ['pending', 'preparing', 'ready', 'dispatched', 'delivered'];

function getStepIndex(status: Order['status']) {
  return statusOrder.indexOf(status);
}

export function CustomerTracking() {
  const { orders, isLoading, error, refresh } = useApiData();
  const [query, setQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  if (isLoading || error) {
    return <ApiFeedback isLoading={isLoading} error={error} onRetry={refresh} />;
  }

  const results = query.length >= 2
    ? orders.filter(
        (o) =>
          o.id.toLowerCase().includes(query.toLowerCase()) ||
          o.customer.toLowerCase().includes(query.toLowerCase()) ||
          o.phone.includes(query)
      )
    : [];

  const selected = orders.find((order) => order.id === selectedOrderId) ?? null;
  const currentStep = selected ? getStepIndex(selected.status) : -1;
  const progressPercent =
    currentStep < 0 ? 0 : (currentStep / (statusOrder.length - 1)) * 100;
  const estimatedMinutes = selected
    ? selected.status === 'pending'
      ? selected.prepTime + 20
      : selected.status === 'preparing'
        ? Math.ceil(selected.prepTime / 2) + 15
        : selected.status === 'ready'
          ? 15
          : selected.status === 'dispatched'
            ? 10
            : null
    : null;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Search */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Track a Customer Order</h2>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Order ID, customer name or phone…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedOrderId(null); }}
            className="pl-9 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
          />
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Order status and courier assignment refresh automatically about every 5 seconds.</p>

        {results.length > 0 && !selected && (
          <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden">
            {results.map((order) => (
              <button
                key={order.id}
                onClick={() => { setSelectedOrderId(order.id); setQuery(order.id); }}
                className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
              >
                <div className="text-left">
                  <span className="font-mono font-bold text-violet-600 text-xs">{order.id}</span>
                  <span className="text-slate-600 ml-3 text-xs">{order.customer}</span>
                </div>
                <StatusBadge status={order.status} />
              </button>
            ))}
          </div>
        )}
        {query.length >= 2 && results.length === 0 && !selected && (
          <p className="mt-3 text-xs text-slate-400">No matching orders found.</p>
        )}
      </Card>

      {/* Tracking details */}
      {selected && (
        <Card>
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-sm font-bold text-violet-600">{selected.id}</p>
                <p className="text-base font-semibold text-slate-900 mt-0.5">{selected.customer}</p>
                <p className="text-xs text-slate-500">{selected.phone}</p>
              </div>
              <StatusBadge status={selected.status} />
            </div>
          </div>

          <div className="p-5">
            {/* Order details */}
            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Brand</p>
                <p className="font-medium text-slate-800">{selected.brand}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Total</p>
                <p className="font-semibold text-slate-900">₹{selected.total}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Delivery Address</p>
                <p className="font-medium text-slate-800">{selected.address}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Rider</p>
                <p className="font-medium text-slate-800">{selected.rider ?? 'Not assigned yet'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Estimated Delivery</p>
                <p className="font-medium text-slate-800">
                  {selected.status === 'delivered'
                    ? 'Delivered'
                    : selected.status === 'cancelled'
                      ? 'Unavailable'
                      : `About ${estimatedMinutes} min (demo estimate)`}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-slate-400 mb-0.5">Items</p>
                <p className="font-medium text-slate-800">{selected.items.join(', ')}</p>
              </div>
            </div>

            {/* Timeline */}
            {selected.status !== 'cancelled' && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Order Timeline</p>
                <div className="relative mx-2 mb-5 h-9">
                  <div className="absolute left-0 right-0 top-4 h-1 rounded-full bg-slate-100" />
                  <div
                    className="absolute left-0 top-4 h-1 rounded-full bg-gradient-to-r from-violet-500 to-orange-400 transition-all duration-700"
                    style={{ width: `${progressPercent}%` }}
                  />
                  <div
                    className="absolute top-0 -translate-x-1/2 transition-all duration-700"
                    style={{ left: `${progressPercent}%` }}
                    aria-label="Delivery progress"
                  >
                    <Bike size={18} className="text-orange-500 animate-pulse" />
                  </div>
                </div>
                <div className="relative">
                  {/* Progress line */}
                  <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-100" />
                  <div
                    className="absolute left-4 top-4 w-0.5 bg-gradient-to-b from-violet-500 to-orange-400 transition-all duration-700"
                    style={{ height: `${(currentStep / (statusOrder.length - 1)) * 100}%` }}
                  />
                  <div className="space-y-5 relative">
                    {timeline.map(({ status, label, icon: Icon }, i) => {
                      const done = i <= currentStep;
                      const active = i === currentStep;
                      return (
                        <div key={status} className="flex items-center gap-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ring-2 transition-all duration-300 ${
                            done
                              ? active
                                ? 'bg-gradient-to-br from-violet-500 to-orange-400 ring-violet-200 shadow-md shadow-violet-500/30'
                                : 'bg-violet-500 ring-violet-100'
                              : 'bg-white ring-slate-200'
                          }`}>
                            <Icon size={14} className={done ? 'text-white' : 'text-slate-300'} />
                          </div>
                          <div>
                            <p className={`text-sm font-semibold ${done ? 'text-slate-900' : 'text-slate-400'}`}>
                              {label}
                            </p>
                            {active && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <Clock size={11} className="text-orange-500" />
                                <span className="text-[11px] text-orange-500 font-medium">In progress · {selected.time}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {selected.status === 'cancelled' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600 font-medium text-center">
                This order was cancelled.
              </div>
            )}
          </div>
        </Card>
      )}

      {!selected && query.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Search size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Enter an order ID, customer name or phone number to track</p>
        </div>
      )}
    </div>
  );
}
