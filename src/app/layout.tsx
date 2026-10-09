import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppLayout } from '@/components/AppLayout';

export const metadata: Metadata = {
  title: 'FEVER - Trendy Collection',
  description: 'Event billing pad for FEVER Trendy Collection',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
