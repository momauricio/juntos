import type { Metadata } from "next";

import { CodigoConviteForm } from "@/components/codigo-convite-form";

export const metadata: Metadata = {
  title: "Entrar com convite · Juntos",
};

export default function CodigoConvitePage() {
  return <CodigoConviteForm />;
}
