import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-2xl font-black tracking-tight">Not found</h1>
      <p className="mt-2 text-[14px] text-stone-600">That experiment or page doesn’t exist. Uploads can disappear when the server storage is wiped — re-uploading restores it.</p>
      <div className="mt-4 flex justify-center gap-2">
        <Link href="/upload" className="rounded-full bg-cyan-700 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-cyan-600">Upload a video</Link>
        <Link href="/lab/real-tomato" className="rounded-full border border-stone-300 bg-white px-4 py-2.5 text-[13px] font-bold hover:border-stone-900">Open real footage</Link>
      </div>
    </main>
  );
}
