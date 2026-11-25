import { ShoppingBag, Zap, Clock, Truck } from 'lucide-react';
import { KPICard } from '../components/ui/KPICard';
import { RecentOrdersTable } from '../components/overview/RecentOrdersTable';
import { BrandDistributionChart } from '../components/overview/BrandDistributionChart';
import { KitchenActivity } from '../components/overview/KitchenActivity';
import { KitchenAlerts } from '../components/overview/KitchenAlerts';
import type { NavPage } from '../types';
import { useApiData } from '../contexts/ApiDataContext';
import { getBrandStats } from '../contexts/apiDataUtils';
import { ApiFeedback } from '../components/ui/ApiFeedback';
import { getAverageKitchenPrepMinutes, getCompletedKitchenDurations } from '../analytics';

interface OverviewProps {
  onNavigate: (page: NavPage) => void;
}

export function Overview({ onNavigate }: OverviewProps) {
  const { brands, orders, liveOrders, isLoading, error, refresh } = useApiData();
  if (isLoading || error) {
    return <ApiFeedback isLoading={isLoading} error={error} onRetry={refresh} />;
  }

  const activeOrders = orders.filter(
    (order) => order.status !== 'delivered' && order.status !== 'cancelled'
  );
  const averagePrepTime = getAverageKitchenPrepMinutes(liveOrders);
  const completedPrepCount = getCompletedKitchenDurations(liveOrders).length;
  const pendingDispatches = liveOrders.filter(
    (order) => order.status === 'Packed' && order.courierId === null
  ).length;
  const brandStats = getBrandStats(orders, brands);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Kitchen and delivery overview</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Current order and delivery activity across your kitchens.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title="Total Orders"
          value={orders.length}
          subtitle="Across all brands"
          icon={ShoppingBag}
          iconBg="bg-violet-100"
          iconColor="text-violet-600"
        />
        <KPICard
          title="Active Orders"
          value={activeOrders.length}
          subtitle="Currently in progress"
          icon={Zap}
          iconBg="bg-orange-100"
          iconColor="text-orange-500"
        />
        <KPICard
          title="Avg Prep Time"
          value={averagePrepTime ?? '—'}
          suffix={averagePrepTime === null ? undefined : 'min'}
          subtitle={averagePrepTime === null
            ? 'No completed kitchen timings yet'
            : `From ${completedPrepCount} completed orders`}
          icon={Clock}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
        />
        <KPICard
          title="Pending Dispatches"
          value={pendingDispatches}
          subtitle="Awaiting rider assignment"
          icon={Truck}
          iconBg="bg-rose-100"
          iconColor="text-rose-500"
        />
      </div>

      {/* Orders + Chart Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <RecentOrdersTable
            orders={orders.slice(0, 8)}
            onViewAll={() => onNavigate('all-orders')}
          />
        </div>
        <div>
          <BrandDistributionChart data={brandStats} />
        </div>
      </div>

      <KitchenAlerts orders={liveOrders} />
      <KitchenActivity brands={brands} orders={liveOrders} />
    </div>
  );
}
