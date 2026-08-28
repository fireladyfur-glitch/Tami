import { describe, expect, it } from "vitest";
import { CAPRICORNUS_ACCESSORIES_CAMPAIGN } from "./capricornusCreatorCampaign";
import {
  buildNightlyReport,
  buildSafeReplyDraft,
  checkSendEligibility,
  classifyReply,
  emailWordCount,
  generateOutreachSequence,
  rankForFirstWave,
  scoreCreator,
  type CreatorLead,
} from "./creatorOutreach";

const lead: CreatorLead = {
  id: "creator-1",
  name: "Anna",
  platform: "Instagram",
  handle: "@annastyle",
  profileUrl: "https://instagram.com/annastyle",
  publicBusinessEmail: "collabs@annastyle.example",
  emailSourceUrl: "https://annastyle.example/contact",
  country: "United States",
  niche: "midlife winter style",
  recentContent: "layering a wool coat for a snowy city weekend",
  followers: 18000,
  salesHistoryScore: 80,
  conversionRate: 6.2,
  contentFitScore: 95,
  engagementRate: 5,
  postingConsistencyScore: 90,
  daysSinceLastPost: 2,
  publicContactVerifiedAt: "2026-08-28",
  isPublicBusinessContact: true,
};

describe("creator scoring", () => {
  it("uses the approved weighted dimensions and returns a tier", () => {
    const result = scoreCreator(lead);
    expect(result.score).toBe(92);
    expect(result.tier).toBe("S");
    expect(result.confidence).toBe(100);
  });

  it("does not promote a creator when critical evidence is missing", () => {
    const result = scoreCreator({
      ...lead,
      salesHistoryScore: undefined,
      conversionRate: undefined,
    });
    expect(result.confidence).toBe(50);
    expect(result.score).toBeLessThan(70);
  });
});

describe("send safety", () => {
  it("requires a verified public business contact with provenance", () => {
    expect(checkSendEligibility(lead, []).eligible).toBe(true);
    const blocked = checkSendEligibility(
      { ...lead, isPublicBusinessContact: false },
      [],
    );
    expect(blocked.eligible).toBe(false);
  });

  it("blocks prior contacts and suppressed addresses", () => {
    const result = checkSendEligibility(lead, [lead.publicBusinessEmail]);
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("Email is on the suppression list.");
  });
});

describe("outreach sequence", () => {
  it("creates D0, D3, D7 and D14 emails with a short first email", () => {
    const sequence = generateOutreachSequence(
      lead,
      CAPRICORNUS_ACCESSORIES_CAMPAIGN,
    );
    expect(sequence.map(({ day }) => day)).toEqual([0, 3, 7, 14]);
    expect(emailWordCount(sequence[0].body)).toBeLessThanOrEqual(75);
    expect(sequence[0].body).toContain("$100");
    expect(sequence[0].body).toContain("Would you be open to taking a look?");
    expect(sequence[0].body).toContain('reply "no"');
    expect(sequence[1].body).not.toContain("Just checking in");
  });
});

describe("reply triage", () => {
  it("identifies high intent, paid-only and opt-out replies", () => {
    expect(classifyReply("I would love to collaborate!")).toBe("high_intent");
    expect(classifyReply("Please send your budget and my rate card.")).toBe(
      "paid_only",
    );
    expect(classifyReply("Please remove me from this list.")).toBe(
      "unsubscribe",
    );
  });

  it("auto-drafts only safe, deterministic reply classes", () => {
    expect(
      buildSafeReplyDraft(
        "high_intent",
        "Anna",
        CAPRICORNUS_ACCESSORIES_CAMPAIGN,
      ),
    ).toContain("shipping country");
    expect(
      buildSafeReplyDraft(
        "paid_only",
        "Anna",
        CAPRICORNUS_ACCESSORIES_CAMPAIGN,
      ),
    ).toBeNull();
  });
});

describe("ranking and reporting", () => {
  it("ranks only eligible S/A creators for the first wave", () => {
    const results = rankForFirstWave(
      [
        lead,
        {
          ...lead,
          id: "creator-2",
          publicBusinessEmail: "blocked@example.com",
        },
      ],
      ["blocked@example.com"],
      30,
    );
    expect(results).toHaveLength(1);
    expect(results[0].lead.id).toBe("creator-1");
  });

  it("lists high-intent creators and pauses above the bounce threshold", () => {
    const report = buildNightlyReport({
      discovered: 20,
      verified: 10,
      sent: 10,
      replies: [
        {
          creator: "Anna",
          email: lead.publicBusinessEmail,
          intent: "high_intent",
        },
      ],
      bounced: 1,
      suppressed: 2,
    });
    expect(report).toContain("Anna");
    expect(report).toContain("PAUSE");
  });
});

