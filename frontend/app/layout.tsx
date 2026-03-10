import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Milki API Console",
  description: "Browser console for Milki Tanzania Property Intelligence API"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
