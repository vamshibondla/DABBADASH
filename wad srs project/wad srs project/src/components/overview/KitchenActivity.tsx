import { Clock, Flame, Package } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';
import type { ApiBrand, ApiOrder } from '../../services/api';

interface KitchenActivityProps {
  brands: ApiBrand[];
  orders: ApiOrder[];
}

export function KitchenActivity({ brands, orders }: KitchenActivityProps) {
  const activity = brands.map((brand) => {
    const brandOrders = orders.filter((order) => order.brandId === brand.id);
    return {
      brand,
      preparing: brandOrders.filter((order) => order.status === 'In Kitchen').length,
      received: brandOrders.filter((order) => order.status === 'Received').length,
      packed: brandOrders.filter((order) => order.status === 'Packed').length,
    };
  });
  const peakPreparing = Math.max(1, ...activity.map((item) => item.preparing));

  return (
    <Card>
      <CardHeader title="Kitchen Activity" subtitle="Current orders by brand and status" />
      {activity.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">No brand data is available.</p>
      ) : (
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activity.map(({ brand, preparing, received, packed }) => (
            <div
              key={brand.id}
              className="border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-sm transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold text-slate-800 leading-tight">{brand.name}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{brand.cuisineType}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  preparing > 0 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  {preparing > 0 ? 'Cooking' : 'No active prep'}
                </span>
              </div>

              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full rounded-full bg-orange-400 transition-all duration-500"
                  style={{ width: `${(preparing / peakPreparing) * 100}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="flex items-center justify-center gap-1 text-orange-500 mb-0.5">
                    <Flame size={12} />
                  </div>
                  <p className="text-sm font-bold text-slate-900">{preparing}</p>
                  <p className="text-[10px] text-slate-400">In kitchen</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-violet-500 mb-0.5">
                    <Clock size={12} />
                  </div>
                  <p className="text-sm font-bold text-slate-900">{received}</p>
                  <p className="text-[10px] text-slate-400">Received</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-emerald-500 mb-0.5">
                    <Package size={12} />
                  </div>
                  <p className="text-sm font-bold text-slate-900">{packed}</p>
                  <p className="text-[10px] text-slate-400">Packed</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
