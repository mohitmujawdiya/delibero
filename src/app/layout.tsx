import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Delibero — Multi-Agent Strategic Debate",
  description:
    "AI-powered strategic debate platform where multiple expert personas deliberate your toughest business questions through adversarial reasoning and consensus synthesis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
