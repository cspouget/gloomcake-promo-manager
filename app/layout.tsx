import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'GloomCake HQ — Release Agent',
  description: 'Autonomous GloomCake release creative, rendering, approval, scheduling, and analytics system',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
