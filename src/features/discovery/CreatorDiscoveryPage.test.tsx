import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CreatorDiscoveryPage } from "./CreatorDiscoveryPage";
import type { CreatorDiscoveryResponse } from "./creatorDiscovery";

const response: CreatorDiscoveryResponse = {
  creators: [
    {
      creatorId: "a-creator",
      platform: "Instagram",
      handle: "@a_creator",
      profileUrl: "https://instagram.com/a_creator",
      name: "A Creator",
      country: "United States",
      niche: "midlife winter style",
      recentContent: "scarf styling",
      followers: 18_000,
      publicBusinessEmail: "a@example.com",
      emailSourceUrl: "https://example.com/contact",
      publicContactVerifiedAt: "2026-08-28",
      isPublicBusinessContact: true,
      score: 78,
      confidence: 90,
      status: "verified",
      tags: ["midlife", "winter style"],
      postsAnalyzed: 10,
      averageLikes: 900,
      averageComments: 45,
      interactionRate: 5.25,
      approvalStatus: "pending",
      notes: "",
    },
    {
      creatorId: "b-creator",
      platform: "Instagram",
      handle: "@b_creator",
      profileUrl: "https://instagram.com/b_creator",
      name: "B Creator",
      country: "United States",
      niche: "considered living",
      recentContent: "natural materials",
      publicBusinessEmail: "b@example.com",
      emailSourceUrl: "https://example.org/contact",
      publicContactVerifiedAt: "2026-08-28",
      isPublicBusinessContact: true,
      score: 62,
      confidence: 70,
      status: "verified",
      tags: ["considered living"],
      postsAnalyzed: 10,
      approvalStatus: "pending",
      notes: "",
    },
  ],
  meta: {
    generatedAt: "2026-08-28T14:00:00.000Z",
    dailyTarget: 100,
    dailyCollected: 2,
    senderGate: "blocked",
    senderEmail: "legacy-sender@example.com",
    socialHandleVerified: false,
    dailySendCap: 10,
    sentToday: 0,
  },
};

afterEach(() => vi.restoreAllMocks());

describe("CreatorDiscoveryPage", () => {
  it("renders visual creator cards and keeps automatic outreach blocked", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(response), { status: 200 }),
    );
    render(<CreatorDiscoveryPage />);

    expect(
      await screen.findByRole("heading", { name: "达人发现中心" }),
    ).toBeInTheDocument();
    expect(screen.getByText("A Creator")).toBeInTheDocument();
    expect(screen.getByText("B Creator")).toBeInTheDocument();
    expect(screen.getByText("自动建联暂缓")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "批准建联" }),
    ).toBeInTheDocument();
  });

  it("filters cards by class", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(response), { status: 200 }),
    );
    render(<CreatorDiscoveryPage />);
    await screen.findByText("A Creator");

    fireEvent.change(screen.getByLabelText("达人分类"), {
      target: { value: "B" },
    });
    expect(screen.queryByText("A Creator")).not.toBeInTheDocument();
    expect(screen.getByText("B Creator")).toBeInTheDocument();
  });

  it("persists B-class approval through the private local API", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(response), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...response,
            creators: response.creators.map((creator) =>
              creator.creatorId === "b-creator"
                ? { ...creator, approvalStatus: "approved" as const }
                : creator,
            ),
          }),
          { status: 200 },
        ),
      );

    render(<CreatorDiscoveryPage />);
    fireEvent.click(await screen.findByRole("button", { name: "批准建联" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(await screen.findByText("当前：approved")).toBeInTheDocument();
  });
});
