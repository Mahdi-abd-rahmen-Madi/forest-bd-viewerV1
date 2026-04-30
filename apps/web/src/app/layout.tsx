import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Forest BD Viewer',
    description: 'French forest data visualization',
};

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="h-full overflow-hidden">
        <head>
            {/* WMS Preconnection Optimization */}
            <link rel="dns-prefetch" href="/geoserver" />
            <link rel="preconnect" href="/geoserver" crossOrigin="anonymous" />
            
            {/* Additional preconnections for common external resources */}
            <link rel="dns-prefetch" href="//api.mapbox.com" />
            <link rel="preconnect" href="//api.mapbox.com" crossOrigin="anonymous" />
            <link rel="dns-prefetch" href="//events.mapbox.com" />
            <link rel="preconnect" href="//events.mapbox.com" crossOrigin="anonymous" />
        </head>
        <body className={`${inter.className} h-full w-full overflow-hidden`}>
        <Providers>{children}</Providers>
        </body>
        </html>
    );
}