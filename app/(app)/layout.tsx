import { redirect } from "next/navigation";

import { TopNav } from "@/components/space-header";
import { SpaceLive } from "@/components/space-live";
import { signInPathWithNext } from "@/lib/auth-callback";
import { getAuthUser, getMySpaceId } from "@/lib/session";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // getAuthUser/getMySpaceId usam cache() por requisição: a page (e
  // generateMetadata) desta mesma navegação reaproveitam o resultado em vez
  // de repetir a verificação de auth e a consulta a space_members.
  const user = await getAuthUser();

  if (!user) {
    redirect(signInPathWithNext(null));
  }

  const spaceId = await getMySpaceId(user.id);

  if (!spaceId) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-dvh text-foreground">
      <SpaceLive spaceId={spaceId} />
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
