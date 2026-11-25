import { useEffect, useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import { useApiData } from '../contexts/ApiDataContext';
import { ApiFeedback } from '../components/ui/ApiFeedback';
import type { OrderStatus } from '../types';

const statusFilters: { label: string; value: OrderStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Preparing', value: 'preparing' },
  { label: 'Ready', value: 'ready' },
  { label: 'Dispatched', value: 'dispatched' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
];

export function AllOrders({ initialSearch = '' }: { initialSearch?: string }) {
  const { orders, isLoading, error, refresh } = useApiData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  if (isLoading || error) {
    return <ApiFeedback isLoading={isLoading} error={error} onRetry={refresh} />;
  }

  const filtered = orders.filter((o) => {
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      o.id.toLowerCase().includes(q) ||
      o.customer.toLowerCase().includes(q) ||
      o.brand.toLowerCase().includes(q) ||
      o.area.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-5">
      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            aria-label="Search orders by ID, customer, brand, or area"
            type="text"
            placeholder="Search by ID, customer, brand…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
          />
        </div>
        {/* Status tabs */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 flex-wrap">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              aria-pressed={statusFilter === f.value}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                statusFilter === f.value
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 ml-auto">
          <Filter size={13} />
          {filtered.length} of {orders.length} orders
        </div>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Orders with status, customer, and delivery information</caption>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Order ID</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Brand</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Items</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Area</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Time</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Rider</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-sm text-slate-400">
                    No orders match your filter.
                  </td>
                </tr>
              ) : (
                filtered.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-violet-600">{order.id}</td>
                    <td className="px-4 py-3.5">
                      <p className="text-xs font-medium text-slate-800">{order.customer}</p>
                      <p className="text-[11px] text-slate-400">{order.phone}</p>
                    </td>
                    <td className="px-4 py-3.5 text-xs font-medium text-slate-700">{order.brand}</td>
                    <td className="px-4 py-3.5">
                      <p className="text-xs text-slate-600 max-w-[160px] truncate">{order.items.join(', ')}</p>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">{order.area}</td>
                    <td className="px-4 py-3.5 text-xs font-semibold text-slate-900">₹{order.total}</td>
                    <td className="px-4 py-3.5"><StatusBadge status={order.status} /></td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">{order.time}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">{order.rider ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
