import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Card, CardHeader } from '../ui/Card';
import type { BrandStat } from '../../types';

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 shadow-xl">
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-white text-xs font-semibold">
          {p.value} orders
        </p>
      ))}
    </div>
  );
}

interface BrandDistributionChartProps {
  data: BrandStat[];
}

export function BrandDistributionChart({ data }: BrandDistributionChartProps) {
  return (
    <Card className="h-full">
      <CardHeader
        title="Brand Distribution"
        subtitle="Orders by brand"
      />
      <div className="p-5">
        {data.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-500">No brand order data is available.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  width={72}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="orders" radius={[0, 6, 6, 0]} maxBarSize={22}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {data.map((brand) => (
                <div key={brand.name} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: brand.color }} />
                  <span className="text-xs text-slate-600 truncate">{brand.name}</span>
                  <span className="text-xs font-semibold text-slate-900 ml-auto">{brand.orders}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
