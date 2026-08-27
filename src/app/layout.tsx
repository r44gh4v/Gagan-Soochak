import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { AppHeader } from "@/components/layout/AppHeader";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gagan Soochak - Civic Hazard Operations",
  description:
    "On-device drone/dashcam hazard detection and civic repair workflow for Electronic City, Bengaluru. Potholes, waterlogging and drain overflow - detected in your browser, tracked to closure.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <TooltipProvider delayDuration={200}>
          <AppHeader />
          {/* Pages own their padding: /monitor fills the viewport exactly so
              its controls never fall below the fold; the rest scroll normally. */}
          <main>{children}</main>
          <Toaster position="bottom-right" richColors closeButton />
        </TooltipProvider>
      </body>
    </html>
  );
}
