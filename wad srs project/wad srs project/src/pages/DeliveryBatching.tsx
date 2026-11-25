import { useState } from 'react';
import {
  Bike,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  MapPin,
  Package,
  XCircle,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { ApiFeedback } from '../components/ui/ApiFeedback';
import { useApiData } from '../contexts/ApiDataContext';
import type { ApiDeliveryBatch, ApiDeliveryBatchStatus } from '../services/api';

const batchStatusConfig: Record<
  ApiDeliveryBatchStatus,
  { label: string; icon: React.ElementType; color: string; bg: string; border: string }
> = {
  pending: {
    label: 'Pending',
    icon: Circle,
    color: 'text-slate-500',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
  },
  assigned: {
    label: 'Assigned',
    icon: Bike,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  'in-progress': {
    label: 'In Progress',
    icon: Loader2,
    color: 'text-orange-500',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  cancelled: {
    label: 'Cancelled',
    icon: XCircle,
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
  },
};

export function DeliveryBatching() {
  const {
    batches,
    isLoading,
    error,
    refresh,
    generateDeliveryBatches,
    assignBatchCourier,
    updateDeliveryBatchStatus,
  } = useApiData();
  const [isGenerating, setIsGenerating] = useState(false);
  const [workingBatchId, setWorkingBatchId] = useState<number | null>(null);
  const [selectedCouriers, setSelectedCouriers] = useState<Record<number, number | ''>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (isLoading || error) {
    return <ApiFeedback isLoading={isLoading} error={error} onRetry={refresh} />;
  }

  const runBatchAction = async (
    batch: ApiDeliveryBatch,
    action: () => Promise<unknown>,
    successMessage: string
  ) => {
    setWorkingBatchId(batch.id);
    setActionError(null);
    setNotice(null);
    try {
      await action();
      setNotice(successMessage);
    } catch (requestError) {
      setActionError(
        requestError instanceof Error ? requestError.message : 'Unable to update the delivery batch.'
      );
    } finally {
      setWorkingBatchId(null);
    }
  };

  const generateBatches = async () => {
    setIsGenerating(true);
    setActionError(null);
    setNotice(null);
    try {
      const generated = await generateDeliveryBatches();
      setNotice(
        generated.length > 0
          ? `Generated ${generated.length} delivery batch${generated.length === 1 ? '' : 'es'}.`
          : 'No new Packed orders could be grouped within 2.5 km.'
      );
    } catch (requestError) {
      setActionError(
        requestError instanceof Error ? requestError.message : 'Unable to generate delivery batches.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Packed orders within 2.5 km are grouped to minimise travel. Distances are straight-line
          estimates between order locations.
        </p>
        <button
          type="button"
          onClick={() => void generateBatches()}
          disabled={isGenerating}
          className="px-4 py-2 text-xs font-semibold text-white bg-violet-600 rounded-xl hover:bg-violet-700 disabled:opacity-60 transition-colors"
        >
          {isGenerating ? 'Generating…' : 'Generate batches'}
        </button>
      </div>

      <p className="text-[11px] text-slate-400">
        “Simulated (demo)” indicates an illustrative zone-based location, not real GPS.
      </p>
      {actionError && (
        <p role="alert" className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
          {actionError}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
          {notice}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Batches', value: batches.length, color: 'text-violet-600' },
          {
            label: 'In Progress',
            value: batches.filter((batch) => batch.status === 'in-progress').length,
            color: 'text-orange-500',
          },
          {
            label: 'Pending',
            value: batches.filter((batch) => batch.status === 'pending').length,
            color: 'text-amber-600',
          },
          {
            label: 'Completed',
            value: batches.filter((batch) => batch.status === 'completed').length,
            color: 'text-emerald-600',
          },
        ].map(({ label, value, color }) => (
          <Card key={label} className="p-4">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </Card>
        ))}
      </div>

      {batches.length === 0 ? (
        <Card className="p-10 text-center">
          <Package size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-700">No delivery batches yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Generate batches from eligible Packed orders.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {batches.map((batch) => {
            const cfg = batchStatusConfig[batch.status];
            const StatusIcon = cfg.icon;
            const selectedCourierId =
              selectedCouriers[batch.id] || batch.recommendedCouriers[0]?.id || '';
            const isWorking = workingBatchId === batch.id;
            return (
              <Card key={batch.id}>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-violet-600">
                          {batch.batchRef}
                        </span>
                        <span
                          className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.color}`}
                        >
                          <StatusIcon size={10} />
                          {cfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                        <MapPin size={14} className="text-orange-500" />
                        {batch.deliveryZoneName ?? 'Multiple delivery zones'}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Approx. distance</p>
                      <div className="flex items-center gap-1 justify-end">
                        <Clock size={12} className="text-slate-500" />
                        <span className="text-sm font-bold text-slate-900">
                          {batch.distanceKm.toFixed(2)} km
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {batch.distanceSource === 'actual'
                          ? 'GPS coordinates'
                          : 'Simulated (demo)'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-4">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Orders ({batch.orderCount})
                    </p>
                    {batch.orders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center gap-3 text-xs py-1.5 border-b border-slate-50 last:border-0"
                      >
                        <Package size={12} className="text-violet-500 flex-shrink-0" />
                        <span className="font-mono font-bold text-violet-600 flex-shrink-0">
                          {order.orderRef}
                        </span>
                        <span className="text-slate-700 truncate">{order.customerName}</span>
                        <span className="ml-auto text-slate-500 flex-shrink-0 truncate max-w-[42%]">
                          {order.deliveryAddress}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <div className="flex items-center gap-2 text-xs">
                      <Bike size={13} className="text-violet-500" />
                      <span className="text-slate-500">Assigned courier:</span>
                      <span className="font-semibold text-slate-800">
                        {batch.courierName ?? 'None'}
                      </span>
                    </div>
                    {batch.status === 'pending' && (
                      <div className="space-y-2">
                        {batch.recommendedCouriers.length > 0 ? (
                          <>
                            <p className="text-[11px] text-slate-500">
                              Recommended: {batch.recommendedCouriers[0].name} (
                              {batch.recommendedCouriers[0].projectedActiveOrders}/
                              {batch.recommendedCouriers[0].maxActiveOrders} active orders)
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                aria-label={`Courier for ${batch.batchRef}`}
                                value={selectedCourierId}
                                onChange={(event) =>
                                  setSelectedCouriers((current) => ({
                                    ...current,
                                    [batch.id]: Number(event.target.value),
                                  }))
                                }
                                className="min-w-[180px] flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                              >
                                {batch.recommendedCouriers.map((courier) => (
                                  <option key={courier.id} value={courier.id}>
                                    {courier.name} · {courier.projectedActiveOrders}/
                                    {courier.maxActiveOrders} active
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={isWorking || selectedCourierId === ''}
                                onClick={() =>
                                  void runBatchAction(
                                    batch,
                                    () => assignBatchCourier(batch.id, Number(selectedCourierId)),
                                    `Courier assigned to ${batch.batchRef}.`
                                  )
                                }
                                className="px-3 py-1.5 text-xs font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-60"
                              >
                                Assign courier
                              </button>
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-slate-400">
                            No available courier has capacity for every order in this batch.
                          </p>
                        )}
                      </div>
                    )}
                    {batch.status === 'assigned' && (
                      <button
                        type="button"
                        disabled={isWorking}
                        onClick={() =>
                          void runBatchAction(
                            batch,
                            () => updateDeliveryBatchStatus(batch.id, 'in-progress'),
                            `${batch.batchRef} is now in progress.`
                          )
                        }
                        className="px-3 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 rounded-lg hover:bg-violet-100 disabled:opacity-60"
                      >
                        Start delivery
                      </button>
                    )}
                    {batch.status === 'in-progress' && (
                      <button
                        type="button"
                        disabled={isWorking}
                        onClick={() =>
                          void runBatchAction(
                            batch,
                            () => updateDeliveryBatchStatus(batch.id, 'completed'),
                            `${batch.batchRef} marked completed.`
                          )
                        }
                        className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 disabled:opacity-60"
                      >
                        Complete batch
                      </button>
                    )}
                    {batch.status === 'pending' && (
                      <button
                        type="button"
                        disabled={isWorking}
                        onClick={() =>
                          void runBatchAction(
                            batch,
                            () => updateDeliveryBatchStatus(batch.id, 'cancelled'),
                            `${batch.batchRef} cancelled.`
                          )
                        }
                        className="text-[11px] font-medium text-slate-400 hover:text-rose-600 disabled:opacity-60"
                      >
                        Cancel batch
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
