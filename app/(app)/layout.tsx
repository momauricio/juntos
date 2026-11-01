import { redirect } from "next/navigation";

import { TopNav } from "@/components/space-header";
import { SpaceLive } from "@/components/space-live";
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
      <SpaceLive spaceId={membership.space_id} />
      {/* Navegação discreta, integrada ao gradiente (mockups 06/08/09 não têm barra) */}
      <header className="px-5 pt-2">
        <TopNav
          list={{ href: "/" }}
          add={{ href: "/items/new" }}
          settings={{ href: "/settings" }}
        />
      </header>

      {children}
    </div>
  );
}
