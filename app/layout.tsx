import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tetris Ultra - Next-Gen Block Puzzle",
  description: "Experience Tetris like never before with stunning visuals, power-ups, and competitive gameplay",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
