import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { Navigation } from "@/components/Navigation";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DabbaTrack — COD Courier Tracking & Reconciliation",
  description: "Manage, track, and reconcile Cash-on-Delivery courier parcels with live status updates and AI label extraction.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-kraft-bg text-text-ink font-sans">
        <Navigation />
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </body>
    </html>
  );
}
