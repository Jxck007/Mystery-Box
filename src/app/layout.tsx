import type { Metadata } from "next";
import { Geist_Mono, Inter, Space_Grotesk } from "next/font/google";
import { HeaderNavLinks, MobileNavLinks } from "./nav-links";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Mystery Box Event",
  description: "Teams solve mystery tasks, open boxes, and earn points under admin oversight.",
  icons: {
    icon: "/Logo.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
      </head>
      <body
        className={`${inter.variable} ${geistMono.variable} ${spaceGrotesk.variable} antialiased`}
      >
        <header
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            background: "var(--bg-base)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 32px",
            height: "64px",
            borderBottom: "1px solid rgba(66,74,53,0.2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            <span
              style={{
                fontFamily: "var(--font-headline)",
                fontWeight: 900,
                fontSize: 22,
                letterSpacing: "-0.04em",
                color: "#fff",
                textTransform: "uppercase",
              }}
            >
              SYMPOSIUM
            </span>
          </div>
          <HeaderNavLinks />
        </header>
        <div style={{ paddingTop: 64 }}>{children}</div>
        <nav className="mobile-nav">
          <MobileNavLinks />
        </nav>
      </body>
    </html>
  );
}
