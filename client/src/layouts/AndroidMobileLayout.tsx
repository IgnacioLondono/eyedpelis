import { Outlet, useLocation } from 'react-router-dom';
import MobileBottomNav from '../components/android/MobileBottomNav';
import PageTransition from '../components/PageTransition';

export default function AndroidMobileLayout() {
  const { pathname } = useLocation();
  const hideNav = pathname.startsWith('/watch/');

  return (
    <div className="min-h-screen android-mobile-shell bg-surface">
      <main className={`android-mobile-main ${hideNav ? '' : 'pb-[calc(56px+env(safe-area-inset-bottom))]'}`}>
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
      {!hideNav && <MobileBottomNav />}
    </div>
  );
}
