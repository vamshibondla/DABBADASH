import {
  LayoutDashboard, ShoppingBag, ChefHat, Bike,
  Package, Map, Users, BarChart2, Settings, LogOut,
} from 'lucide-react';
import type { NavPage } from '../../types';
import { useApiData } from '../../contexts/ApiDataContext';

interface NavItem {
  id: NavPage;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { id: 'overview',           label: 'Overview',           icon: LayoutDashboard },
  { id: 'all-orders',         label: 'All Orders',         icon: ShoppingBag },
  { id: 'kitchen-board',      label: 'Kitchen Board',      icon: ChefHat },
  { id: 'rider-dispatch',     label: 'Rider Dispatch',     icon: Bike },
  { id: 'delivery-batching',  label: 'Delivery Batching',  icon: Package },
  { id: 'live-map',           label: 'Live Map',           icon: Map },
  { id: 'customer-tracking',  label: 'Customer Tracking',  icon: Users },
  { id: 'analytics',          label: 'Analytics',          icon: BarChart2 },
];

interface SidebarProps {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ activePage, onNavigate, mobileOpen, onClose }: SidebarProps) {
  const { orders, batches } = useApiData();
  const pageBadges: Partial<Record<NavPage, number>> = {
    'all-orders': orders.length,
    'kitchen-board': orders.filter(
      (order) => order.status === 'pending' || order.status === 'preparing'
    ).length,
    'delivery-batching': batches.length,
  };

  return (
    <aside
      id="primary-navigation"
      aria-label="Primary navigation"
      className={`fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-slate-800 bg-slate-900 transition-transform duration-200 md:visible md:translate-x-0 ${
        mobileOpen ? 'visible translate-x-0' : 'invisible -translate-x-full'
      }`}
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-orange-500 rounded-xl flex items-center justify-center text-lg shadow-lg">
            🍱
          </div>
          <div>
            <span className="text-white font-bold text-base tracking-tight">DabbaDash</span>
            <p className="text-slate-500 text-[10px] font-medium mt-0.5 uppercase tracking-wider">Food Ops Dashboard</p>
          </div>
        </div>
      </div>

      {/* Nav Items */}
      <nav aria-label="Main menu" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        <p className="text-slate-600 text-[10px] font-semibold uppercase tracking-widest px-3 mb-3">Main Menu</p>
        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = activePage === id;
          const badge = pageBadges[id];
          return (
            <button
              type="button"
              key={id}
              onClick={() => {
                onNavigate(id);
                onClose();
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`
                w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group
                ${isActive
                  ? 'bg-gradient-to-r from-violet-600 to-violet-700 text-white shadow-lg shadow-violet-900/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'}
              `}
            >
              <span className="flex items-center gap-3">
                <Icon
                  size={18}
                  className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}
                />
                {label}
              </span>
              {badge !== undefined && (
                <span className={`
                  text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center
                  ${isActive ? 'bg-white/20 text-white' : 'bg-orange-500 text-white'}
                `}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 pt-2 border-t border-slate-800 space-y-0.5">
        <button
          type="button"
          disabled
          title="Settings are not available in this demo."
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 opacity-60 cursor-not-allowed"
        >
          <Settings size={18} className="text-slate-500" />
          Settings <span className="ml-auto text-[9px] uppercase tracking-wide">Demo</span>
        </button>
        <button
          type="button"
          disabled
          title="Sign-in is not enabled for this demo."
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 opacity-60 cursor-not-allowed"
        >
          <LogOut size={18} className="text-slate-500" />
          Log Out <span className="ml-auto text-[9px] uppercase tracking-wide">Demo</span>
        </button>
        <div className="mt-3 flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-orange-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            M
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-semibold truncate">Demo operator</p>
            <p className="text-slate-500 text-[10px] truncate">Ops Manager</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
