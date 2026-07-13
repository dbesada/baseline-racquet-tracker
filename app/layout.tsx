import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  return {
    metadataBase,
    title: "Baseline — Canadian racquet deal tracker",
    description:
      "Track Canadian prices for the Wilson Blade 98, Yonex EZONE 98, and Babolat Pure Aero 98.",
    openGraph: {
      title: "Baseline — Racquet prices, watched.",
      description: "Five Canadian stores. Four racquets. One clean deal feed.",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-CA">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
