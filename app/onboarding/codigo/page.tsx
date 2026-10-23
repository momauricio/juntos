import type { Metadata } from "next";

import { CodigoConviteForm } from "@/components/codigo-convite-form";

export const metadata: Metadata = {
  title: "Código de convite · Juntos",
};

export default function CodigoConvitePage() {
  return <CodigoConviteForm />;
}
