export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6" aria-busy="true">
      <div className="h-8 w-64 animate-pulse rounded-xl bg-stone-200" />
      <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded-lg bg-stone-200" />
      <div className="mt-6 grid gap-3 lg:grid-cols-12">
        <div className="aspect-square animate-pulse rounded-2xl bg-stone-200 lg:col-span-7" />
        <div className="flex flex-col gap-3 lg:col-span-5">
          <div className="h-32 animate-pulse rounded-2xl bg-stone-200" />
          <div className="h-32 animate-pulse rounded-2xl bg-stone-200" />
        </div>
      </div>
    </main>
  );
}
