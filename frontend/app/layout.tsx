import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Club Search",
  description: "Search and discover AI clubs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
