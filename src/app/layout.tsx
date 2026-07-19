import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Indrajit's Smart NSE Predictor — BTST · Short-term · Midterm",
  description: "Professional multi-factor technical predictor for NSE stocks. Run daily at 8 PM to get BUY recommendations with entry, target, stop loss, and confidence score for the next trading day.",
  keywords: ["NSE", "BTST", "stock predictor", "technical analysis", "Indian stock market", "trading"],
  authors: [{ name: "Indrajit's Smart NSE Predictor" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Indrajit's Smart NSE Predictor",
    description: "BTST, Short-term & Midterm predictions for NSE stocks",
    url: "https://chat.z.ai",
    siteName: "Indrajit's Smart NSE Predictor",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Indrajit's Smart NSE Predictor",
    description: "BTST, Short-term & Midterm predictions for NSE stocks",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
