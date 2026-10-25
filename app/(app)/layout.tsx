import { redirect } from "next/navigation";
import Link from "next/link";

import { signInPathWithNext } from "@/lib/auth-callback";
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
    redirect(signInPathWithNext(null));
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
      {/* Navegação discreta, integrada ao gradiente (mockups 06/08/09 não têm barra) */}
      <header className="px-5 pt-2">
        <nav
          aria-label="Navegação principal"
          className="mx-auto flex w-full max-w-lg items-center justify-end gap-1 text-[13px] font-semibold text-cream/60"
        >
          <Link
            href="/"
            className="flex h-11 items-center rounded-full px-2.5 transition hover:text-cream"
          >
            Lista
          </Link>
          <Link
            href="/items/new"
            aria-label="Nova ideia"
            className="group flex h-11 w-11 items-center justify-center rounded-full transition hover:text-cream"
          >
            <span
              aria-hidden="true"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-cream/25 text-lg leading-none transition group-hover:border-cream/50"
            >
              +
            </span>
          </Link>
          <Link
            href="/settings"
            className="flex h-11 items-center rounded-full px-2.5 transition hover:text-cream"
          >
            Ajustes
          </Link>
        </nav>
      </header>

      {children}
    </div>
  );
}
