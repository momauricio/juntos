import { describe, expect, it } from "vitest";

import { inviteFlowState } from "@/lib/invite-flow";
import type { InvitePreviewStatus } from "@/lib/invites";

const valid = { status: "valid" as const, is_member: false };

describe("inviteFlowState", () => {
  it.each(["used", "expired", "full", "invalid"] as InvitePreviewStatus[])(
    "shows the %s error, logged in or not",
    (status) => {
      const preview = { status, is_member: false };
      expect(inviteFlowState({ preview, loggedIn: false, mySpace: null })).toBe(
        `error:${status}`,
      );
      expect(
        inviteFlowState({
          preview: { status, is_member: true },
          loggedIn: true,
          mySpace: { memberCount: 2, itemCount: 0, partnerName: "Bia" },
        }),
      ).toBe(`error:${status}`);
    },
  );

  it("asks a signed out person to sign in", () => {
    expect(inviteFlowState({ preview: valid, loggedIn: false, mySpace: null })).toBe(
      "signed_out",
    );
  });

  it("recognizes the host's own invite", () => {
    expect(
      inviteFlowState({
        preview: { status: "valid", is_member: true },
        loggedIn: true,
        mySpace: { memberCount: 1, itemCount: 3, partnerName: null },
      }),
    ).toBe("own");
  });

  it("joins directly without a space", () => {
    expect(inviteFlowState({ preview: valid, loggedIn: true, mySpace: null })).toBe(
      "join",
    );
  });

  it("offers to switch when alone in another space", () => {
    expect(
      inviteFlowState({
        preview: valid,
        loggedIn: true,
        mySpace: { memberCount: 1, itemCount: 2, partnerName: null },
      }),
    ).toBe("switch_alone");
  });

  it("blocks when already with a partner", () => {
    expect(
      inviteFlowState({
        preview: valid,
        loggedIn: true,
        mySpace: { memberCount: 2, itemCount: 2, partnerName: "Caio" },
      }),
    ).toBe("blocked_partner");
  });
});
