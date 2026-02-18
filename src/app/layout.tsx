import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeToaster } from "@/components/theme/theme-toaster";
import { PersistentYouTubeProvider } from "@/components/layout/persistent-youtube-provider";

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
    <html lang="en" suppressHydrationWarning className="overflow-x-hidden dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('lockedin-theme');if(t==='light'){document.documentElement.classList.remove('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased overflow-x-hidden w-full relative`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <PersistentYouTubeProvider>
            {children}
            <ThemeToaster />
          </PersistentYouTubeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
