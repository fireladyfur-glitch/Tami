import { describe, expect, it } from "vitest";
import {
  calculateInteractionRate,
  canQueueAutomaticOutreach,
  compactMetric,
  creatorClassForScore,
  type CreatorDiscoveryRecord,
} from "./creatorDiscovery";

const record: CreatorDiscoveryRecord = {
  creatorId: "creator-1",
  platform: "Instagram",
  handle: "@midlifestylist",
  profileUrl: "https://instagram.com/midlifestylist",
  name: "Maya",
  country: "United States",
  niche: "midlife winter style",
  recentContent: "winter texture styling",
  followers: 10_000,
  publicBusinessEmail: "collabs@example.com",
  emailSourceUrl: "https://example.com/contact",
  publicContactVerifiedAt: "2026-08-28",
  isPublicBusinessContact: true,
  score: 78,
  confidence: 90,
  status: "verified",
  tags: ["midlife", "winter style"],
  postsAnalyzed: 10,
  averageLikes: 420,
  averageComments: 30,
  interactionRate: 4.5,
  approvalStatus: "pending",
  notes: "",
};

describe("creator discovery classification", () => {
  it("maps the operating model to A, B and C", () => {
    expect(creatorClassForScore(85)).toBe("A");
    expect(creatorClassForScore(70)).toBe("A");
    expect(creatorClassForScore(69)).toBe("B");
    expect(creatorClassForScore(55)).toBe("B");
    expect(creatorClassForScore(54)).toBe("C");
  });

  it("calculates last-ten-post interaction rate without guessing", () => {
    expect(calculateInteractionRate(10_000, 420, 30)).toBeCloseTo(4.5);
    expect(calculateInteractionRate(undefined, 420, 30)).toBeUndefined();
    expect(
      calculateInteractionRate(10_000, undefined, undefined),
    ).toBeUndefined();
  });

  it("only queues A creators when the sender and public-contact gates pass", () => {
    expect(canQueueAutomaticOutreach(record, "ready")).toBe(true);
    expect(canQueueAutomaticOutreach(record, "blocked")).toBe(false);
    expect(canQueueAutomaticOutreach({ ...record, score: 65 }, "ready")).toBe(
      false,
    );
  });

  it("formats absent metrics as pending rather than inventing a value", () => {
    expect(compactMetric(undefined)).toBe("待采集");
    expect(compactMetric(6219)).toBe("6.2K");
  });
});
