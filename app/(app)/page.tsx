export default function HomePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-stone-50 px-4 py-10 text-stone-950">
      <section className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-stone-200">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-500">
          Juntos
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Lista em breve
        </h1>
        <p className="mt-4 text-sm leading-6 text-stone-600">
          Sua lista compartilhada vai aparecer aqui nas proximas etapas.
        </p>
      </section>
    </main>
  );
}
