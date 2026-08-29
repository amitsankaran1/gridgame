import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Nav from "@/components/Nav";
import "./globals.css";

// Self-hosted at build time, so there's no request to Google at runtime.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

/**
 * Without metadataBase the og:image tag is emitted as a relative path, which
 * every link unfurler ignores — so the share preview silently falls back to
 * nothing. Vercel sets VERCEL_PROJECT_PRODUCTION_URL in production; set
 * NEXT_PUBLIC_SITE_URL to override (a custom domain, say).
 */
function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: "gridgame",
  description: "The house chalkboard, online. A new grid every week.",
  // app/opengraph-image.tsx supplies the image itself; this is what tells
  // Twitter/X to render it large rather than as a thumbnail beside the text.
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <div className="shell">
          <Nav />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
