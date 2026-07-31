import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "CoChart is a free, open-source tool for real-time collaborative market charting. " +
  "Open a candlestick chart, draw trendlines and Fibonacci levels, and share a live " +
  "link — no signup required.";

export const metadata: Metadata = {
  metadataBase: new URL("https://cochart.app"),
  title: {
    default: "CoChart — Collaborative Financial Charting",
    template: "%s · CoChart",
  },
  description,
  applicationName: "CoChart",
  authors: [{ name: "CoChart" }],
  creator: "CoChart",
  publisher: "CoChart",
  category: "finance",
  keywords: [
    "charting",
    "financial charts",
    "candlestick chart",
    "collaborative charting",
    "real-time charts",
    "websocket",
    "trading",
    "technical analysis",
    "Fibonacci retracement",
    "trendlines",
    "open source",
    "self-hosted",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "CoChart",
    url: "/",
    title: "CoChart — Collaborative Financial Charting",
    description,
    locale: "en_US",
    images: [
      {
        url: "/favicon.ico",
        width: 512,
        height: 512,
        alt: "CoChart",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "CoChart — Collaborative Financial Charting",
    description,
    images: ["/favicon.ico"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Analytics />
        <SpeedInsights />
        {children}
      </body>
    </html>
  );
}
