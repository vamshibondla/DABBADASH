import { AlertTriangle } from 'lucide-react';
import { getKitchenDelayAlerts } from '../../analytics';
import type { ApiOrder } from '../../services/api';

export function KitchenAlerts({ orders }: { orders: ApiOrder[] }) {
  const alerts = getKitchenDelayAlerts(orders);
  if (alerts.length === 0) return null;

  return (
    <section
      aria-label="Kitchen delay alerts"
      className="rounded-2xl border border-amber-300 bg-amber-50 p-4"
      role="status"
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
        <AlertTriangle size={17} />
        Kitchen orders over 20 minutes
      </div>
      <ul className="space-y-1">
        {alerts.map((alert) => (
          <li key={alert.orderId} className="text-xs text-amber-800">
            <span className="font-semibold">{alert.orderRef}</span>
            {' · '}{alert.brandName}
            {' · '}{alert.elapsedMinutes} min in kitchen
          </li>
        ))}
      </ul>
    </section>
  );
}
