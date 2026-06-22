import { Outlet } from 'react-router-dom';
import TvSidebar from '../components/android/TvSidebar';
import PageTransition from '../components/PageTransition';

export default function AndroidTvLayout() {
  return (
    <div className="min-h-screen tv-layout flex bg-surface">
      <TvSidebar />
      <main className="flex-1 ml-[220px] tv-main min-h-screen overflow-x-hidden">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
    </div>
  );
}
