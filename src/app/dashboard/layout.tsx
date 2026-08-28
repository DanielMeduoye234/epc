import { AuthProvider } from '@/components/AuthProvider';
import Sidebar from '@/components/Sidebar';
import AssistantWidget from '@/components/AssistantWidget';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <main className="lg:pl-[var(--sidebar-width,18rem)] transition-[padding] duration-200 ease-out motion-reduce:transition-none">
          <div className="pt-16 px-4 pb-6 sm:px-6 sm:pt-6 lg:p-8">{children}</div>
        </main>
        <AssistantWidget />
      </div>
    </AuthProvider>
  );
}
