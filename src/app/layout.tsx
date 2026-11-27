import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const brand = localFont({ src: "./fonts/ArchivoBlack.woff2", variable: "--font-archivo", display: "swap" });

export const metadata: Metadata = {
  title: { default: "AJ Fitness Admin", template: "%s · AJ Fitness" },
  description: "AJ Fitness — members, renewals, payments and attendance on your phone.",
  applicationName: "AJ Fitness Admin",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "AJ Fitness", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0b0d10",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${brand.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
