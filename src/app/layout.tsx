import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import PreloaderWrapper from '@/components/PreloaderWrapper';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

const inter = Inter({
  subsets: ['latin'],
});

export const viewport: Viewport = {
  themeColor: '#f97316',
};

export const metadata: Metadata = {
  title: 'Everything by Prayer',
  description: 'Church Growth Dashboard for tracking New Believers, First Timers, and Members',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/logo.png' },
    ],
    apple: [
      { url: '/logo.png' },
    ],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Everything by Prayer',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className} data-scroll-behavior="smooth">
      <body className="min-h-screen">
        <PreloaderWrapper />
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
