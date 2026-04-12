import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ALPHA SPORTS MASTER | Intelligence OS",
  description: "Next-generation sports analysis and prediction platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="terminal-scan antialiased">
        {children}
      </body>
    </html>
  );
}
