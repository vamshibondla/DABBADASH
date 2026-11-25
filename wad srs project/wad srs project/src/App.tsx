import { lazy, Suspense, useState } from 'react';
import { Layout } from './components/layout/Layout';
import type { NavPage } from './types';
import { ApiDataProvider } from './contexts/ApiDataContext';

const Overview = lazy(() => import('./pages/Overview').then(({ Overview }) => ({ default: Overview })));
const AllOrders = lazy(() => import('./pages/AllOrders').then(({ AllOrders }) => ({ default: AllOrders })));
const KitchenBoard = lazy(() =>
  import('./pages/KitchenBoard').then(({ KitchenBoard }) => ({ default: KitchenBoard }))
);
const RiderDispatch = lazy(() =>
  import('./pages/RiderDispatch').then(({ RiderDispatch }) => ({ default: RiderDispatch }))
);
const DeliveryBatching = lazy(() =>
  import('./pages/DeliveryBatching').then(({ DeliveryBatching }) => ({ default: DeliveryBatching }))
);
const LiveMap = lazy(() => import('./pages/LiveMap').then(({ LiveMap }) => ({ default: LiveMap })));
const CustomerTracking = lazy(() =>
  import('./pages/CustomerTracking').then(({ CustomerTracking }) => ({ default: CustomerTracking }))
);
const Analytics = lazy(() => import('./pages/Analytics').then(({ Analytics }) => ({ default: Analytics })));

function App() {
  const [activePage, setActivePage] = useState<NavPage>('overview');
  const [orderSearch, setOrderSearch] = useState('');

  function renderPage() {
    switch (activePage) {
      case 'overview':          return <Overview onNavigate={setActivePage} />;
      case 'all-orders':        return <AllOrders initialSearch={orderSearch} />;
      case 'kitchen-board':     return <KitchenBoard />;
      case 'rider-dispatch':    return <RiderDispatch />;
      case 'delivery-batching': return <DeliveryBatching />;
      case 'live-map':          return <LiveMap />;
      case 'customer-tracking': return <CustomerTracking />;
      case 'analytics':         return <Analytics />;
    }
  }

  return (
    <ApiDataProvider>
      <Layout
        activePage={activePage}
        onNavigate={setActivePage}
        onSearchOrders={(query) => {
          setOrderSearch(query);
          setActivePage('all-orders');
        }}
      >
        <Suspense
          fallback={
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              Loading page…
            </div>
          }
        >
          {renderPage()}
        </Suspense>
      </Layout>
    </ApiDataProvider>
  );
}

export default App;
