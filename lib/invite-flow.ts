import type { InvitePreview, InvitePreviewStatus } from "@/lib/invites";

export type MySpaceSummary = {
  memberCount: number;
  itemCount: number;
  partnerName: string | null;
};

export type InviteFlowState =
  | "signed_out"
  | `error:${Exclude<InvitePreviewStatus, "valid">}`
  | "own"
  | "join"
  | "switch_alone"
  | "blocked_partner";

type InviteFlowInput = {
  preview: Pick<InvitePreview, "status" | "is_member">;
  loggedIn: boolean;
  mySpace: MySpaceSummary | null;
};

// Estado da tela de convite (/c/[code]).
export function inviteFlowState({
  preview,
  loggedIn,
  mySpace,
}: InviteFlowInput): InviteFlowState {
  if (preview.status !== "valid") {
    return `error:${preview.status}`;
  }

  if (loggedIn && preview.is_member) {
    return "own";
  }

  if (!loggedIn) {
    return "signed_out";
  }

  if (!mySpace) {
    return "join";
  }

  return mySpace.memberCount > 1 ? "blocked_partner" : "switch_alone";
}
