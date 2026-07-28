import { redirect } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("space_members")
    .select("space_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-dvh bg-stone-50 text-stone-950">
      <header className="border-b border-stone-200 bg-white/90 px-4 py-4">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-stone-950"
          >
            Juntos
          </Link>

          <nav className="flex items-center gap-2 text-sm font-semibold">
            <Link
              href="/"
              className="rounded-full px-3 py-2 text-stone-700 transition hover:bg-stone-100 hover:text-stone-950"
            >
              Lista
            </Link>
            <Link
              href="/items/new"
              aria-label="Nova ideia"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500 text-lg leading-none text-white transition hover:bg-rose-600"
            >
              +
            </Link>
            <Link
              href="/settings"
              className="rounded-full px-3 py-2 text-stone-700 transition hover:bg-stone-100 hover:text-stone-950"
            >
              Configurações
            </Link>
          </nav>
        </div>
      </header>

      {children}
    </div>
  );
}
