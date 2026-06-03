import { AuthProvider } from '@/components/AuthProvider';
import Sidebar from '@/components/Sidebar';

export const dynamic = 'force-dynamic';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <main className="lg:pl-72">
          <div className="pt-16 px-4 pb-6 sm:px-6 sm:pt-6 lg:p-8">{children}</div>
        </main>
      </div>
    </AuthProvider>
  );
}
