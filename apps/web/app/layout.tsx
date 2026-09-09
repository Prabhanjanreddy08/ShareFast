import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';

export const metadata: Metadata = {
  title: 'ShareFast • Direct Peer-to-Peer File Transfer',
  description: 'Fast offline peer-to-peer file sharing directly between nearby devices with zero cloud upload, zero accounts, and zero external storage.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png'
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#09090b',
  viewportFit: 'cover'
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-[100dvh] flex flex-col antialiased bg-ambient-glow selection:bg-blue-500/20 selection:text-blue-500">
        <ServiceWorkerRegister />
        <Navbar />
        <main className="flex-1 flex flex-col justify-center px-4 py-8 max-w-5xl mx-auto w-full">
          {children}
        </main>
        <footer className="w-full py-4 text-center text-xs text-neutral-400 dark:text-neutral-600 border-t border-neutral-200/40 dark:border-neutral-800/40">
          Direct P2P Transfer • WebRTC DataChannel • No Cloud Storage
        </footer>
      </body>
    </html>
  );
}
