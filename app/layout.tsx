import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { LangProvider } from "@/lib/LangContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import { Footer } from "@/components/Footer";
import { BottomNav } from "@/components/BottomNav";
import { CruzFab } from "@/components/CruzFab";
import { PWASetup } from "@/components/PWASetup";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://cruzar.app'),
  title: "Cruzar – Live US-Mexico Border Wait Times",
  description: "Live wait times to cross from Mexico into the US at all 52 border ports. Free for commuters and freight.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Cruzar",
  },
  openGraph: {
    title: "Cruzar – Live US-Mexico Border Wait Times",
    description: "Real-time wait times at every US-Mexico border crossing. Free for drivers and freight operators.",
    url: "https://cruzar.app",
    siteName: "Cruzar",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "https://cruzar.app/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Cruzar – Live US-Mexico Border Wait Times",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cruzar – Live US-Mexico Border Wait Times",
    description: "Real-time wait times at every US-Mexico border crossing.",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Cruzar" />
        <meta name="theme-color" content="#0f172a" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="google-adsense-account" content="ca-pub-8997191973110385" />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <LangProvider>
            {/* Extra bottom padding on mobile so content clears the tab bar */}
            <div className="flex-1 pb-16 sm:pb-0">
              {children}
            </div>
            <Footer />
            <BottomNav />
            <CruzFab />
            <PWASetup />
          </LangProvider>
        </ThemeProvider>
        <Analytics />
        {process.env.NEXT_PUBLIC_ADSENSE_CLIENT && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
