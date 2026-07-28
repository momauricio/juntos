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
    <div className="min-h-dvh text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/85 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4">
          <Link
            href="/"
            className="font-serif text-xl font-semibold tracking-tight text-accent-strong"
          >
            Juntos
          </Link>

          <nav className="flex items-center gap-2 text-sm font-semibold">
            <Link
              href="/"
              className="flex h-11 items-center rounded-2xl px-3 text-foreground/80 transition hover:bg-accent-soft hover:text-accent-strong"
            >
              Lista
            </Link>
            <Link
              href="/items/new"
              aria-label="Nova ideia"
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-strong text-2xl leading-none text-accent-contrast transition hover:bg-accent"
            >
              +
            </Link>
            <Link
              href="/settings"
              className="flex h-11 items-center rounded-2xl px-3 text-foreground/80 transition hover:bg-accent-soft hover:text-accent-strong"
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
