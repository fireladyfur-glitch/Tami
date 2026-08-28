export type CreatorClass = "A" | "B" | "C";

export type CreatorDiscoveryRecord = {
  creatorId: string;
  platform: string;
  handle: string;
  profileUrl: string;
  name: string;
  country: string;
  niche: string;
  recentContent: string;
  followers?: number;
  publicBusinessEmail: string;
  emailSourceUrl: string;
  publicContactVerifiedAt: string;
  isPublicBusinessContact: boolean;
  score: number;
  confidence: number;
  status: string;
  tags: string[];
  postsAnalyzed: number;
  averageLikes?: number;
  averageComments?: number;
  averageViews?: number;
  interactionRate?: number;
  metricsVerifiedAt?: string;
  approvalStatus: "pending" | "approved" | "rejected";
  approvalUpdatedAt?: string;
  notes: string;
};

export type CreatorDiscoveryResponse = {
  creators: CreatorDiscoveryRecord[];
  meta: {
    generatedAt: string;
    dailyTarget: number;
    dailyCollected: number;
    senderGate: "ready" | "blocked";
    senderEmail: string;
    socialHandleVerified: boolean;
    dailySendCap: number;
    sentToday: number;
  };
};

export function creatorClassForScore(score: number): CreatorClass {
  if (score >= 70) return "A";
  if (score >= 55) return "B";
  return "C";
}

export function calculateInteractionRate(
  followers: number | undefined,
  averageLikes: number | undefined,
  averageComments: number | undefined,
): number | undefined {
  if (!followers || followers <= 0) return undefined;
  if (averageLikes === undefined && averageComments === undefined)
    return undefined;
  return (((averageLikes ?? 0) + (averageComments ?? 0)) / followers) * 100;
}

export function compactMetric(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "待采集";
  return new Intl.NumberFormat("en-US", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

export function creatorClassReason(record: CreatorDiscoveryRecord): string {
  const creatorClass = creatorClassForScore(record.score);
  if (creatorClass === "A")
    return "评分达到自动建联门槛；仍需通过公开邮箱、发件身份和抑制名单检查。";
  if (creatorClass === "B")
    return "内容有潜力，但需要您查看主页和近十篇内容后批准建联。";
  return "当前证据或数据不足，先观察并补齐互动率、活跃度与转化信号。";
}

export function canQueueAutomaticOutreach(
  record: CreatorDiscoveryRecord,
  senderGate: CreatorDiscoveryResponse["meta"]["senderGate"],
): boolean {
  return (
    creatorClassForScore(record.score) === "A" &&
    senderGate === "ready" &&
    record.isPublicBusinessContact &&
    Boolean(record.publicBusinessEmail && record.emailSourceUrl)
  );
}
