import { StatusBadge } from '../ui/Badge';
import { Card, CardHeader } from '../ui/Card';
import type { Order } from '../../types';
import { ExternalLink } from 'lucide-react';

interface RecentOrdersTableProps {
  orders: Order[];
  onViewAll: () => void;
}

export function RecentOrdersTable({ orders, onViewAll }: RecentOrdersTableProps) {
  return (
    <Card>
      <CardHeader
        title="Recent Orders"
        subtitle={`${orders.length} orders shown`}
        action={
          <button
            onClick={onViewAll}
            className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700 transition-colors"
          >
            View All <ExternalLink size={12} />
          </button>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Order ID</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Brand</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Time</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Rider</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">
                  No orders yet.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/70 transition-colors group">
                  <td className="px-5 py-3.5">
                    <span className="font-mono font-semibold text-violet-600 text-xs">{order.id}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div>
                      <p className="font-medium text-slate-800 text-xs">{order.customer}</p>
                      <p className="text-slate-400 text-[11px]">{order.area}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs font-medium text-slate-700">{order.brand}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-semibold text-slate-900 text-xs">₹{order.total}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-slate-500">{order.time}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-slate-600">{order.rider ?? '—'}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
