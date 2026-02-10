import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tasmania - Run AI Models Locally",
  description: "Search, download, and run LLM models locally with zero configuration. Powered by llama.cpp.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
