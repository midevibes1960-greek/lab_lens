import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { FlaskConical, Upload, Play } from "lucide-react";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LabLens — upload a lab video, get counts + report",
  description:
    "Upload a phone time-lapse of your plate or tray. LabLens counts everything, draws growth curves, flags contamination and writes your results.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-screen flex flex-col bg-[#fafaf7] text-stone-900">
        <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-[#fafaf7]/95 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-stone-900 text-white">
                <FlaskConical className="size-4" />
              </span>
              <span className="leading-none">
                <span className="block text-[16px] font-bold tracking-tight">LabLens</span>
                <span className="block text-[11px] font-medium text-stone-500">
                  Video in → counts + report out
                </span>
              </span>
            </Link>
            <nav className="ml-4 hidden items-center gap-1 text-[13px] font-semibold text-stone-600 lg:flex">
              <Link href="/#how" className="rounded-lg px-3 py-1.5 hover:bg-stone-900/5 hover:text-stone-900">How it works</Link>
              <Link href="/lab/real-tomato" className="rounded-lg px-3 py-1.5 hover:bg-stone-900/5 hover:text-stone-900">Real footage</Link>
              <Link href="/evaluation" className="rounded-lg px-3 py-1.5 hover:bg-stone-900/5 hover:text-stone-900">How accurate?</Link>
              <Link href="/study" className="rounded-lg px-3 py-1.5 hover:bg-stone-900/5 hover:text-stone-900">Accuracy study</Link>
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <Link
                href="/lab/real-tomato"
                className="hidden items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3.5 py-2 text-[13px] font-bold hover:border-stone-900 sm:flex"
              >
                <Play className="size-4" /> Try real footage
              </Link>
              <Link
                href="/upload"
                className="flex items-center gap-1.5 rounded-full bg-cyan-700 px-4 py-2 text-[13px] font-bold text-white shadow hover:bg-cyan-600"
              >
                <Upload className="size-4" /> Upload video
              </Link>
            </div>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-stone-200 bg-white/60">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-5 text-[12px] text-stone-500 sm:flex-row sm:items-center sm:px-6">
            <span>
              <b className="text-stone-700">LabLens</b> — built for the Meta Global AI Hackathon. No AI training needed; every number traces back to your video frames.
            </span>
            <Link href="/upload" className="font-bold text-cyan-800 hover:underline sm:ml-auto">Upload your video →</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
