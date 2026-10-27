import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Evoke Ink",
  description:
    "Create thoughtful, printable reading reflection worksheets for handwriting practice.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
