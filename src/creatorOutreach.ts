export type CreatorTier = "S" | "A" | "B" | "C";

export type CreatorPlatform = "TikTok" | "Instagram" | "YouTube" | "Other";

export type CreatorLead = {
  id: string;
  name: string;
  platform: CreatorPlatform;
  handle: string;
  profileUrl: string;
  publicBusinessEmail: string;
  emailSourceUrl: string;
  country: string;
  niche: string;
  recentContent: string;
  followers?: number;
  salesHistoryScore?: number;
  conversionRate?: number;
  contentFitScore?: number;
  engagementRate?: number;
  postingConsistencyScore?: number;
  daysSinceLastPost?: number;
  publicContactVerifiedAt?: string;
  isPublicBusinessContact: boolean;
};

export type CreatorScore = {
  score: number;
  tier: CreatorTier;
  confidence: number;
  missingSignals: string[];
  breakdown: {
    salesHistory: number;
    conversionRate: number;
    contentFit: number;
    engagement: number;
    postingConsistency: number;
    recentActivity: number;
  };
};

export type OutreachCampaign = {
  brandName: string;
  senderName: string;
  offerValueUsd: number;
  productCategories: string[];
  brandAccount?: string;
  storeUrl: string;
};

export type OutreachEmail = {
  day: 0 | 3 | 7 | 14;
  subject: string;
  body: string;
};

export type ReplyIntent =
  | "high_intent"
  | "interested_needs_details"
  | "paid_only"
  | "question"
  | "declined"
  | "unsubscribe"
  | "out_of_office"
  | "unknown";

export type SendEligibility = {
  eligible: boolean;
  reasons: string[];
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value));

function normalized(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? clamp(value)
    : undefined;
}

function recentActivityScore(days: number | undefined): number | undefined {
  if (typeof days !== "number" || !Number.isFinite(days)) return undefined;
  if (days <= 3) return 100;
  if (days <= 7) return 85;
  if (days <= 14) return 65;
  if (days <= 30) return 30;
  return 0;
}

export function scoreCreator(lead: CreatorLead): CreatorScore {
  const signals = {
    salesHistory: normalized(lead.salesHistoryScore),
    conversionRate:
      typeof lead.conversionRate === "number"
        ? clamp((lead.conversionRate / 6.2) * 100)
        : undefined,
    contentFit: normalized(lead.contentFitScore),
    engagement:
      typeof lead.engagementRate === "number"
        ? clamp((lead.engagementRate / 5) * 100)
        : undefined,
    postingConsistency: normalized(lead.postingConsistencyScore),
    recentActivity: recentActivityScore(lead.daysSinceLastPost),
  };

  const weights = {
    salesHistory: 0.3,
    conversionRate: 0.2,
    contentFit: 0.2,
    engagement: 0.1,
    postingConsistency: 0.1,
    recentActivity: 0.1,
  } as const;

  const missingSignals = Object.entries(signals)
    .filter(([, value]) => value === undefined)
    .map(([key]) => key);
  const score = Math.round(
    Object.entries(weights).reduce((total, [key, weight]) => {
      const value = signals[key as keyof typeof signals] ?? 0;
      return total + value * weight;
    }, 0),
  );
  const confidence = Math.round(
    100 -
      missingSignals.reduce(
        (total, key) => total + weights[key as keyof typeof weights] * 100,
        0,
      ),
  );

  return {
    score,
    tier: score >= 85 ? "S" : score >= 70 ? "A" : score >= 55 ? "B" : "C",
    confidence,
    missingSignals,
    breakdown: Object.fromEntries(
      Object.entries(signals).map(([key, value]) => [key, value ?? 0]),
    ) as CreatorScore["breakdown"],
  };
}

export function checkSendEligibility(
  lead: CreatorLead,
  suppressionEmails: Iterable<string>,
): SendEligibility {
  const reasons: string[] = [];
  const email = lead.publicBusinessEmail.trim().toLowerCase();
  const suppression = new Set(
    Array.from(suppressionEmails, (value) => value.trim().toLowerCase()),
  );

  if (!lead.isPublicBusinessContact)
    reasons.push("Email is not verified as a public business contact.");
  if (!EMAIL_PATTERN.test(email)) reasons.push("Email format is invalid.");
  if (!lead.emailSourceUrl.trim())
    reasons.push("A public source URL is required for provenance.");
  if (!lead.publicContactVerifiedAt?.trim())
    reasons.push("The public contact has not been recently verified.");
  if (suppression.has(email)) reasons.push("Email is on the suppression list.");

  return { eligible: reasons.length === 0, reasons };
}

function cleanSnippet(value: string, fallback: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return fallback;
  return compact.replace(/[.!?]+$/, "");
}

export function emailWordCount(body: string): number {
  return body.trim().split(/\s+/).filter(Boolean).length;
}

export function generateOutreachSequence(
  lead: CreatorLead,
  campaign: OutreachCampaign,
): OutreachEmail[] {
  const name = lead.name.trim() || lead.handle.replace(/^@/, "") || "there";
  const recent = cleanSnippet(lead.recentContent, lead.niche || "winter style");
  const products = campaign.productCategories.join(", ");
  const account = campaign.brandAccount?.trim();
  const tagLine = account
    ? ` and tag ${account}`
    : " and tag our verified brand account";
  const firstBody = [
    `Hi ${name},`,
    `Your recent ${recent} post feels right for ${campaign.brandName}. We’d offer a $${campaign.offerValueUsd} store gift card to choose from our ${products}. If it genuinely suits your style, we ask for one honest short-form video${tagLine}.`,
    "Would you be open to taking a look?",
    'If not relevant, reply "no" and I won’t follow up.',
    `Best,\n${campaign.senderName}`,
  ].join("\n\n");

  const sequence: OutreachEmail[] = [
    {
      day: 0,
      subject: `A considered winter styling idea for ${lead.handle || name}`,
      body: firstBody,
    },
    {
      day: 3,
      subject: `Re: A considered winter styling idea for ${lead.handle || name}`,
      body: [
        `Hi ${name},`,
        `A little more context: the $${campaign.offerValueUsd} gift card lets you choose the piece yourself, so the styling stays true to your wardrobe and audience. There is no scripted praise—only an honest short-form video if you genuinely like it.`,
        "Would you like me to send the selection details?",
        `Best,\n${campaign.senderName}`,
      ].join("\n\n"),
    },
    {
      day: 7,
      subject: `Re: A considered winter styling idea for ${lead.handle || name}`,
      body: [
        `Hi ${name},`,
        `The creative direction is intentionally simple: show the texture, how you style it, and one natural cold-weather moment. You would keep your own voice and disclose the gifted product in the way your platform requires.`,
        "Would this format suit your content?",
        `Best,\n${campaign.senderName}`,
      ].join("\n\n"),
    },
    {
      day: 14,
      subject: `Re: A considered winter styling idea for ${lead.handle || name}`,
      body: [
        `Hi ${name},`,
        `I’ll close the loop after this note. If a $${campaign.offerValueUsd} gift-card collaboration around tactile winter accessories is a fit, reply and I’ll send the next steps. Otherwise, no action is needed and we will not follow up again.`,
        `Warmly,\n${campaign.senderName}\n${campaign.brandName}`,
      ].join("\n\n"),
    },
  ];

  if (emailWordCount(firstBody) > 75)
    throw new Error("The first outreach email must stay within 75 words.");

  return sequence;
}

export function classifyReply(text: string): ReplyIntent {
  const normalizedText = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalizedText) return "unknown";
  if (
    /unsubscribe|remove me|do not contact|don't contact|stop emailing|opt out/.test(
      normalizedText,
    )
  )
    return "unsubscribe";
  if (
    /out of office|automatic reply|away from the office|on vacation/.test(
      normalizedText,
    )
  )
    return "out_of_office";
  if (/not interested|no thank|decline|pass on|not a fit/.test(normalizedText))
    return "declined";
  if (
    /rate card|paid only|budget|my rate|fee is|rates start/.test(normalizedText)
  )
    return "paid_only";
  if (
    /would love|happy to collaborate|i'm interested|i am interested|sounds great|let's do it|count me in/.test(
      normalizedText,
    )
  )
    return "high_intent";
  if (
    /tell me more|send details|more information|what are the details/.test(
      normalizedText,
    )
  )
    return "interested_needs_details";
  if (/\?/.test(normalizedText)) return "question";
  return "unknown";
}

export function buildSafeReplyDraft(
  intent: ReplyIntent,
  creatorName: string,
  campaign: OutreachCampaign,
): string | null {
  const name = creatorName.trim() || "there";
  if (intent === "high_intent" || intent === "interested_needs_details") {
    return [
      `Hi ${name},`,
      `Wonderful—thank you. The collaboration includes a $${campaign.offerValueUsd} ${campaign.brandName} gift card so you can choose the accessory that best fits your style. In return, we ask for one honest short-form video and a tag to our verified brand account.`,
      "Could you confirm your preferred platform and shipping country? We’ll then prepare your unique gift card and selection details.",
      `Best,\n${campaign.senderName}\n${campaign.brandName}`,
    ].join("\n\n");
  }
  if (intent === "declined" || intent === "unsubscribe") {
    return [
      `Hi ${name},`,
      "Thank you for letting us know. I’ve updated our records and we will not follow up again.",
      `Best,\n${campaign.senderName}\n${campaign.brandName}`,
    ].join("\n\n");
  }
  return null;
}

export function rankForFirstWave(
  leads: CreatorLead[],
  suppressionEmails: Iterable<string>,
  limit = 30,
): Array<{ lead: CreatorLead; score: CreatorScore }> {
  return leads
    .map((lead) => ({
      lead,
      score: scoreCreator(lead),
      eligibility: checkSendEligibility(lead, suppressionEmails),
    }))
    .filter(
      ({ score, eligibility }) =>
        eligibility.eligible && (score.tier === "S" || score.tier === "A"),
    )
    .sort(
      (left, right) =>
        right.score.score - left.score.score ||
        right.score.confidence - left.score.confidence ||
        left.lead.handle.localeCompare(right.lead.handle),
    )
    .slice(0, Math.max(0, limit))
    .map(({ lead, score }) => ({ lead, score }));
}

export function buildNightlyReport(input: {
  discovered: number;
  verified: number;
  sent: number;
  replies: Array<{ creator: string; email: string; intent: ReplyIntent }>;
  bounced: number;
  suppressed: number;
}): string {
  const highIntent = input.replies.filter(
    ({ intent }) =>
      intent === "high_intent" || intent === "interested_needs_details",
  );
  const replyRate = input.sent
    ? `${((input.replies.length / input.sent) * 100).toFixed(1)}%`
    : "n/a";
  const bounceRate = input.sent
    ? `${((input.bounced / input.sent) * 100).toFixed(1)}%`
    : "n/a";
  const lines = [
    "# Capricornus Living Creator Outreach — Nightly Report",
    "",
    `Discovered: ${input.discovered}`,
    `Verified public business contacts: ${input.verified}`,
    `Sent: ${input.sent}`,
    `Replies: ${input.replies.length} (${replyRate})`,
    `Bounces: ${input.bounced} (${bounceRate})`,
    `Suppressed: ${input.suppressed}`,
    "",
    `## High-intent creators (${highIntent.length})`,
  ];
  if (highIntent.length === 0) lines.push("None today.");
  else
    highIntent.forEach(({ creator, email, intent }) =>
      lines.push(`- ${creator} — ${email} — ${intent}`),
    );
  if (input.sent > 0 && input.bounced / input.sent > 0.02)
    lines.push(
      "",
      "PAUSE: Bounce rate is above 2%. Stop new sends and re-verify the list.",
    );
  return lines.join("\n");
}

