import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Clock, PackageCheck, ShoppingBag, Star, Truck } from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card';
import { ApiFeedback } from '../components/ui/ApiFeedback';
import { getAverageKitchenPrepMinutes } from '../analytics';
import { useApiData } from '../contexts/ApiDataContext';
import type { ApiOrderStatus } from '../services/api';

const ORDER_STATUSES: ApiOrderStatus[] = [
  'Received',
  'In Kitchen',
  'Packed',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
];

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
  label?: string;
}

function DarkTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 shadow-xl">
      <p className="text-slate-400 text-xs mb-2 font-medium">{label}</p>
      {payload.map((item) => (
        <div key={item.dataKey} className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-slate-300">{item.name}:</span>
          <span className="text-white font-semibold">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

const kpiStyles = [
  { icon: ShoppingBag, color: 'text-violet-600', bg: 'bg-violet-100' },
  { icon: PackageCheck, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  { icon: Truck, color: 'text-orange-500', bg: 'bg-orange-100' },
  { icon: Clock, color: 'text-sky-600', bg: 'bg-sky-100' },
];

export function Analytics() {
  const { brands, liveOrders, liveCouriers, isLoading, error, refresh } = useApiData();
  if (isLoading || error) {
    return <ApiFeedback isLoading={isLoading} error={error} onRetry={refresh} />;
  }

  const deliveredOrders = liveOrders.filter((order) => order.status === 'Delivered').length;
  const activeOrders = liveOrders.filter(
    (order) => order.status !== 'Delivered' && order.status !== 'Cancelled'
  ).length;
  const averagePrepTime = getAverageKitchenPrepMinutes(liveOrders);
  const metrics = [
    { label: 'Total Orders', value: liveOrders.length.toLocaleString() },
    { label: 'Delivered Orders', value: deliveredOrders.toLocaleString() },
    { label: 'Active Orders', value: activeOrders.toLocaleString() },
    { label: 'Avg Kitchen Prep', value: averagePrepTime === null ? '—' : `${averagePrepTime} min` },
  ];

  const statusStats = ORDER_STATUSES.map((status) => ({
    name: status,
    orders: liveOrders.filter((order) => order.status === status).length,
  }));
  const brandStats = brands
    .map((brand) => ({
      name: brand.name,
      orders: liveOrders.filter((order) => order.brandId === brand.id).length,
    }))
    .sort((a, b) => b.orders - a.orders);
  const topRiders = [...liveCouriers]
    .sort((a, b) => b.deliveriesToday - a.deliveriesToday)
    .slice(0, 5);
  const maxDeliveries = Math.max(1, ...topRiders.map((rider) => rider.deliveriesToday));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {metrics.map(({ label, value }, index) => {
          const { icon: Icon, color, bg } = kpiStyles[index];
          return (
            <div
              key={label}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${bg}`}>
                <Icon size={18} className={color} />
              </div>
              <p className="text-xl font-bold text-slate-900">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Order Distribution" subtitle="Current orders by status" />
          <div className="p-5">
            {liveOrders.length === 0 ? (
              <p className="py-16 text-center text-sm text-slate-500">No orders to chart yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={statusStats} margin={{ top: 5, right: 10, left: 0, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<DarkTooltip />} />
                  <Bar dataKey="orders" name="Orders" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={38} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Orders by Brand" subtitle="Current order volume from the backend" />
          <div className="p-5">
            {brandStats.length === 0 ? (
              <p className="py-16 text-center text-sm text-slate-500">No brand data is available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={brandStats} margin={{ top: 5, right: 10, left: 0, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<DarkTooltip />} />
                  <Bar dataKey="orders" name="Orders" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={38} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Top Riders" subtitle="Ranked by deliveries today" />
        <div className="p-5">
          {topRiders.length === 0 ? (
            <p className="text-sm text-slate-500">No courier data is available.</p>
          ) : (
            <div className="space-y-3">
              {topRiders.map((rider, index) => (
                <div key={rider.id} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    index === 0 ? 'bg-amber-100 text-amber-600' :
                    index === 1 ? 'bg-slate-100 text-slate-600' :
                    index === 2 ? 'bg-orange-100 text-orange-600' :
                    'bg-slate-50 text-slate-500'
                  }`}>
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">{rider.name}</p>
                      <span className="text-xs font-bold text-slate-900 ml-2">{rider.deliveriesToday}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-orange-400 rounded-full"
                        style={{ width: `${(rider.deliveriesToday / maxDeliveries) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-amber-500 flex-shrink-0">
                    <Star size={11} className="fill-amber-400" />
                    {rider.rating.toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
