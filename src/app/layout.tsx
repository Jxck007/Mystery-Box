import type { Metadata } from "next";
import { Geist_Mono, Inter, Space_Grotesk } from "next/font/google";
import { HeaderNavLinks } from "./nav-links";
import { SoundBootstrap } from "./sound-bootstrap";
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
  title: "Mystery Box Innovation",
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
        <SoundBootstrap />
        <header className="app-header">
          <div className="app-brand">
            <span className="app-brand-title">
              MYSTERY BOX INNOVATION
            </span>
          </div>
          <div className="header-actions">
            <HeaderNavLinks />
          </div>
        </header>
        <div className="app-body-offset">{children}</div>
      </body>
    </html>
  );
}
