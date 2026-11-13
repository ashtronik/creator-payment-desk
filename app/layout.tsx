import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "Creator Payment Desk",
  description: "A simple, non-custodial desk for creator payments.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full"><div className="relative flex min-h-screen flex-col"><header className="border-b border-line bg-bg-top/80 backdrop-blur"><div className="mx-auto flex h-18 w-full max-w-[1080px] items-center justify-between gap-4 px-4 sm:px-6"><Link href="/" className="flex items-center gap-2.5 font-bold tracking-[-.03em] text-text"><svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7" fill="none"><path d="M5 8.5 16 3l11 5.5v15L16 29 5 23.5v-15Z" fill="#00ec97" stroke="#EAF7F0" strokeWidth="1.5"/><path d="M10 16h12M16 10v12" stroke="#03100C" strokeWidth="2" strokeLinecap="round"/></svg><span>Creator Payment Desk</span></Link><span className="hidden items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-xs font-semibold text-muted sm:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-green" />Payments routed by NEAR Intents</span></div></header><div className="relative z-0 flex-1">{children}</div><footer className="border-t border-line px-4 py-6 text-center text-sm text-muted sm:px-6">Built for the NEAR Hackathon. Non-custodial: we never hold your funds.</footer></div></body>
    </html>
  );
}
