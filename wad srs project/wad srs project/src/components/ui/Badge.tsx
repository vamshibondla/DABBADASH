import type { OrderStatus } from '../../types';

const statusConfig: Record<OrderStatus, { label: string; classes: string }> = {
  pending:    { label: 'Pending',    classes: 'bg-amber-100 text-amber-700 border-amber-200' },
  preparing:  { label: 'Preparing', classes: 'bg-blue-100 text-blue-700 border-blue-200' },
  ready:      { label: 'Ready',     classes: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  dispatched: { label: 'Dispatched',classes: 'bg-violet-100 text-violet-700 border-violet-200' },
  delivered:  { label: 'Delivered', classes: 'bg-slate-100 text-slate-600 border-slate-200' },
  cancelled:  { label: 'Cancelled', classes: 'bg-red-100 text-red-600 border-red-200' },
};

interface StatusBadgeProps {
  status: OrderStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { label, classes } = statusConfig[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${classes}`}>
      {label}
    </span>
  );
}

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'purple' | 'orange' | 'green' | 'red' | 'blue' | 'slate';
  size?: 'sm' | 'md';
}

const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-slate-100 text-slate-700 border-slate-200',
  purple:  'bg-violet-100 text-violet-700 border-violet-200',
  orange:  'bg-orange-100 text-orange-700 border-orange-200',
  green:   'bg-emerald-100 text-emerald-700 border-emerald-200',
  red:     'bg-red-100 text-red-600 border-red-200',
  blue:    'bg-blue-100 text-blue-700 border-blue-200',
  slate:   'bg-slate-100 text-slate-600 border-slate-200',
};

export function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  return (
    <span className={`inline-flex items-center rounded-full font-medium border ${sizeClass} ${variantClasses[variant]}`}>
      {children}
    </span>
  );
}
