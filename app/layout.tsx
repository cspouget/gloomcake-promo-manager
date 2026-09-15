import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'GloomCake Audio Visualizer',
  description: 'GloomCake promo visualizer and renderer'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
