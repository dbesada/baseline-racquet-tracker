import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const localHost = /^(?:localhost|127[.]|10[.]|192[.]168[.]|172[.](?:1[6-9]|2\d|3[01])[.])/i.test(host);
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (localHost ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  return {
    metadataBase,
    title: "Baseline — Canadian racquet deal tracker",
    description:
      "Track Canadian prices for the Wilson Blade 98, Yonex EZONE 98, and Babolat Pure Aero 98.",
    icons: {
      icon: [{ url: "/app-icon.svg", type: "image/svg+xml" }],
      shortcut: "/app-icon-192.png",
      apple: "/apple-touch-icon.png",
    },
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Baseline" },
    openGraph: {
      title: "Baseline — Racquet prices, watched.",
      description: "Canadian stores. Six racquets. One clean deal feed.",
      type: "website",
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "Baseline racquet price tracker" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Baseline — Racquet prices, watched.",
      description: "Canadian deal alerts for the frames you actually want.",
      images: ["/og.png"],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#10251d" },
    { media: "(prefers-color-scheme: dark)", color: "#14262c" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-CA">
      <body>{children}</body>
    </html>
  );
}
