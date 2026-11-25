import { useState } from 'react';
import type { FormEvent } from 'react';
import { Bell, Menu, RefreshCw, Search } from 'lucide-react';
import type { NavPage } from '../../types';
import { useApiData } from '../../contexts/ApiDataContext';
import { getKitchenDelayAlerts } from '../../analytics';

const pageLabels: Record<NavPage, string> = {
  'overview':           'Overview',
  'all-orders':         'All Orders',
  'kitchen-board':      'Kitchen Board',
  'rider-dispatch':     'Rider Dispatch',
  'delivery-batching':  'Delivery Batching',
  'live-map':           'Live Map',
  'customer-tracking':  'Customer Tracking',
  'analytics':          'Analytics',
};

interface HeaderProps {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
  onSearchOrders: (query: string) => void;
  onOpenNavigation: () => void;
  isNavigationOpen: boolean;
}

export function Header({
  activePage,
  onNavigate,
  onSearchOrders,
  onOpenNavigation,
  isNavigationOpen,
}: HeaderProps) {
  const { liveOrders, isLoading, refresh } = useApiData();
  const [search, setSearch] = useState('');
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const kitchenAlerts = getKitchenDelayAlerts(liveOrders).length;

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    if (!query) return;
    onSearchOrders(query);
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenNavigation}
          aria-label={isNavigationOpen ? 'Navigation is open' : 'Open navigation'}
          aria-expanded={isNavigationOpen}
          aria-controls="primary-navigation"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-600 md:hidden"
        >
          <Menu size={18} />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-slate-900">{pageLabels[activePage]}</h1>
          <p className="hidden text-xs text-slate-400 sm:block">{dateStr} · {timeStr}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <form onSubmit={submitSearch} role="search" className="relative hidden lg:block">
          <Search
            aria-hidden="true"
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            aria-label="Search orders by order ID, customer, brand, or area"
            type="text"
            placeholder="Search orders…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-56 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-10 text-sm transition-all focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          />
          <button
            type="submit"
            aria-label="Search orders"
            className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-violet-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-600"
          >
            <Search size={14} />
          </button>
        </form>

        <button
          type="button"
          onClick={() => void refresh().catch(() => undefined)}
          disabled={isLoading}
          aria-label="Refresh dashboard data"
          title="Refresh dashboard data"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-600 disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : undefined} />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('overview')}
          aria-label={kitchenAlerts > 0 ? `View ${kitchenAlerts} kitchen delay alerts` : 'View kitchen alerts'}
          title={kitchenAlerts > 0 ? `${kitchenAlerts} kitchen delay alerts` : 'No kitchen delay alerts'}
          className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-600"
        >
          <Bell size={15} />
          {kitchenAlerts > 0 && (
            <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
              {kitchenAlerts > 9 ? '9+' : kitchenAlerts}
            </span>
          )}
        </button>

        <div
          title="Demo operator"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-orange-400 text-sm font-bold text-white shadow-sm"
        >
          <span role="img" aria-label="Demo operator">M</span>
        </div>
      </div>
    </header>
  );
}
