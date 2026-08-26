import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppBuildBadge } from "@/components/AppBuildBadge";
import { BoardDeviceReturnControl } from "@/components/BoardDeviceReturnControl";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dart Scorekeeper",
  description: "Local-first darts scoring and league management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <BoardDeviceReturnControl />
        <AppBuildBadge />
      </body>
    </html>
  );
}
