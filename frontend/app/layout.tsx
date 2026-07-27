import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocuMate",
  description: "AI-powered document assistant — upload PDFs and chat with your documents.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
