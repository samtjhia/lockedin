import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
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
  title: "The Locked In Factory",
  description: "Productivity factory for tracking work sessions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="overflow-x-hidden bg-zinc-950">
      <body 
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-zinc-50 overflow-x-hidden w-full relative`}
        suppressHydrationWarning
      >
        {children}
        <Toaster theme="dark" position="bottom-right" />
      </body>
    </html>
  );
}
