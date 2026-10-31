"use client";
import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-2xl font-black tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-[14px] text-stone-600">{error.message || "Unexpected error."} Your uploaded videos and saved analyses are stored separately and should still be there.</p>
      <div className="mt-4 flex justify-center gap-2">
        <button onClick={reset} className="rounded-full bg-stone-900 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-stone-700">Try again</button>
        <Link href="/" className="rounded-full border border-stone-300 bg-white px-4 py-2.5 text-[13px] font-bold hover:border-stone-900">Back home</Link>
      </div>
    </main>
  );
}
