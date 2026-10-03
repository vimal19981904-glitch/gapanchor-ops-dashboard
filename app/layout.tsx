import './globals.css';
import { ThemeProvider } from '@/components/ui/ThemeProvider';
import { NavigationProvider } from '@/components/NavigationContext';
import { Toaster } from 'sonner';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';

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

export const metadata = {
  title: 'GapAnchor Ops Dashboard | Finance, Training & WhatsApp Analytics',
  description: 'Enterprise-grade internal operations dashboard for GapAnchor: Finance intelligence, Training ops calendar, WhatsApp participant comms, and Dev progress tracker.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <body className={`${jakarta.variable} ${jetbrains.variable} font-sans antialiased bg-surface-0 text-[var(--text-primary)]`}>
        <ThemeProvider>
          <NavigationProvider>
            {children}
          </NavigationProvider>
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

