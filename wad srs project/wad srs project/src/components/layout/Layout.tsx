import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import type { NavPage } from '../../types';
import { useApiData } from '../../contexts/ApiDataContext';

interface LayoutProps {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
  onSearchOrders: (query: string) => void;
  children: React.ReactNode;
}

export function Layout({ activePage, onNavigate, onSearchOrders, children }: LayoutProps) {
  const { error, isDemoData, isOfflineDemo, liveUpdateError } = useApiData();
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);

  function navigate(page: NavPage) {
    onNavigate(page);
    setIsNavigationOpen(false);
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-violet-700 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <Sidebar
        activePage={activePage}
        onNavigate={navigate}
        mobileOpen={isNavigationOpen}
        onClose={() => setIsNavigationOpen(false)}
      />
      {isNavigationOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setIsNavigationOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/50 md:hidden"
        />
      )}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col md:ml-64">
        <Header
          activePage={activePage}
          onNavigate={navigate}
          onSearchOrders={onSearchOrders}
          onOpenNavigation={() => setIsNavigationOpen(true)}
          isNavigationOpen={isNavigationOpen}
        />
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 p-4 sm:p-6">
          {isOfflineDemo && (
            <p
              role="status"
              className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-800"
            >
              Offline demo mode: showing fictional sample records. Changes need the backend and are not saved while it is unavailable.
            </p>
          )}
          {isDemoData && !isOfflineDemo && (
            <p
              role="status"
              className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-800"
            >
              Demo dataset: fictional customers and orders stored in the local SQLite database. Map positions are simulated.
            </p>
          )}
          {liveUpdateError && !error && (
            <p
              role="status"
              className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"
            >
              Live updates are temporarily unavailable. Showing the most recent data: {liveUpdateError}
            </p>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
