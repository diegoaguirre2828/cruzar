import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { LangProvider } from "@/lib/LangContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import { Footer } from "@/components/Footer";
import { BottomNav } from "@/components/BottomNav";
import { SWRProvider } from "@/components/SWRProvider";
import { CruzFab } from "@/components/CruzFab";
import { ReactionsWelcomeToast } from "@/components/ReactionsWelcomeToast";
import { FirstVisitInstallSheet } from "@/components/FirstVisitInstallSheet";
import { OfflineBanner } from "@/components/OfflineBanner";
import { PWASetup } from "@/components/PWASetup";
import { GlobalInstallPromptCapture } from "@/components/GlobalInstallPromptCapture";
import { ClaimProInPwa } from "@/components/ClaimProInPwa";
import { PwaGrantCelebration } from "@/components/PwaGrantCelebration";
import { SessionPingMount } from "@/components/SessionPingMount";
import { TwaPromoBanner } from "@/components/TwaPromoBanner";
import { GlobalPushPromptOnAlertCreated } from "@/components/GlobalPushPromptOnAlertCreated";
import { MetaPixel } from "@/components/MetaPixel";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
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
      suppressHydrationWarning
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
        <meta name="impact-site-verification" content="8152bcbe-65f7-488d-97e6-53a0f6d80359" />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <LangProvider>
          <SWRProvider>
            {/* Bottom padding on mobile so content clears the tab bar.
                The calc() form accounts for Android gesture-nav phones
                where env(safe-area-inset-bottom) adds real height to
                the BottomNav — without this the last page element can
                sit under the system gesture bar. */}
            <div className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0">
              {children}
            </div>
            <Footer />
            <BottomNav />
            <CruzFab />
            <ReactionsWelcomeToast />
            <FirstVisitInstallSheet />
            <OfflineBanner />
            <PWASetup />
            <GlobalInstallPromptCapture />
            <ClaimProInPwa />
            <PwaGrantCelebration />
            <SessionPingMount />
            <TwaPromoBanner />
            <GlobalPushPromptOnAlertCreated />
          </SWRProvider>
          </LangProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
        <MetaPixel />
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
