import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/lib/providers';

export const metadata: Metadata = {
  title: 'CourtReach',
  description: 'AI-powered outreach for racquet sport clubs',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
