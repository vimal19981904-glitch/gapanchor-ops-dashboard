import './globals.css';
import { ThemeProvider } from '@/components/ui/ThemeProvider';
import { NavigationProvider } from '@/components/NavigationContext';
import { Toaster } from 'sonner';
import { OpsToastController } from '@/components/notifications/OpsToastController';
import { PwaRegister } from '@/components/PwaRegister';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';

import type { Viewport } from 'next';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#0a0d14',
  width: 'device-width',
  initialScale: 1,
};

export const metadata = {
  title: 'GapAnchor Ops Dashboard | Finance, Training & WhatsApp Analytics',
  description: 'Enterprise-grade internal operations dashboard for GapAnchor: Finance intelligence, Training ops calendar, WhatsApp participant comms, and Dev progress tracker.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'GapAnchor',
  },
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <body className={`${jakarta.variable} ${jetbrains.variable} font-sans antialiased bg-surface-0 text-[var(--text-primary)]`}>
        <ThemeProvider>
          <NavigationProvider>
            {children}
          </NavigationProvider>
          <OpsToastController />
          <PwaRegister />
          <Toaster
            position="bottom-right"
            richColors
            toastOptions={{
              style: {
                fontFamily: 'var(--font-jakarta), sans-serif',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}

