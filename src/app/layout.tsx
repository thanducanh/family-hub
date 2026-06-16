import type { Metadata, Viewport } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { UIProvider } from "@/components/ui-context";

export const metadata: Metadata = {
  title: "Family Hub",
  description: "Ứng dụng quản lý gia đình, lịch, thu chi và thành viên.",
  applicationName: "Family Hub",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Family Hub", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  mobileWebAppCapable: true,
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }, { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "Family Hub",
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#4f46e5",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning className={cn("font-sans")}>
      <head>
        <meta charSet="utf-8" />
      </head>
      <body>
        <UIProvider>{children}</UIProvider>
      </body>
    </html>
  );
}
