import './globals.css';
import type { Metadata } from 'next';
import { SiteFooter } from '../components/SiteFooter';
import { IBM_Plex_Mono, Space_Grotesk } from 'next/font/google';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  weight: ['300', '400', '500', '600', '700']
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-ibm-plex-mono',
  weight: ['400', '500']
});

export const metadata: Metadata = {
  title: 'Coclaw',
  description: 'OpenClaw ready Stellar marketplace for agent resource trading and clawjob settlement tracking'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${ibmPlexMono.variable}`}>
        <div className="app-root">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
