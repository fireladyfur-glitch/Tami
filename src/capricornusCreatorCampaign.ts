import type { OutreachCampaign } from "./creatorOutreach";

export const CAPRICORNUS_ACCESSORIES_CAMPAIGN: OutreachCampaign = {
  brandName: "Capricornus Living",
  senderName: "Tami",
  offerValueUsd: 100,
  productCategories: ["hats", "earmuffs", "scarves"],
  storeUrl: "https://capricornusliving.com/collections/accessories",
};

export const CAPRICORNUS_CREATOR_DISCOVERY_RULES = {
  markets: ["United States"],
  platforms: ["TikTok", "Instagram", "YouTube"],
  contentSignals: [
    "self-described midlife, over-40, or over-50 style content",
    "winter styling and cold-weather outfit content",
    "timeless, tactile, natural-material, or considered-living content",
    "recent short-form video activity within 14 days",
    "credible audience engagement rather than follower count alone",
  ],
  contactRules: [
    "Use only a public business or management email published by the creator or their authorized representative.",
    "Store the exact public source URL and verification date.",
    "Do not infer or filter creators by race, ethnicity, appearance, or other sensitive personal traits.",
    "Do not infer age from appearance; use only the creator's self-described content niche or audience positioning.",
    "Do not re-contact an address on the suppression list or a previously contacted address without a documented reactivation decision.",
  ],
  firstWaveLimit: 30,
  maxNewSendsPerDay: 20,
  followUpDays: [3, 7, 14],
  bouncePauseThreshold: 0.02,
} as const;

