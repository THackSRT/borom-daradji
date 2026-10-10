import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-[calc(2.5rem+5rem)] md:pt-[calc(2.5rem+5rem)]">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
