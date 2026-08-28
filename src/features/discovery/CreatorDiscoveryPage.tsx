import { useEffect, useMemo, useState } from "react";
import {
  canQueueAutomaticOutreach,
  compactMetric,
  creatorClassForScore,
  creatorClassReason,
  type CreatorClass,
  type CreatorDiscoveryRecord,
  type CreatorDiscoveryResponse,
} from "./creatorDiscovery";

const API_URL =
  import.meta.env.VITE_CREATOR_API_URL ??
  "http://127.0.0.1:4174/api/creator-discovery";

const emptyResponse: CreatorDiscoveryResponse = {
  creators: [],
  meta: {
    generatedAt: "",
    dailyTarget: 100,
    dailyCollected: 0,
    senderGate: "blocked",
    senderEmail: "not connected",
    socialHandleVerified: false,
    dailySendCap: 10,
    sentToday: 0,
  },
};

type ClassFilter = "All" | CreatorClass;

function metricLabel(value: number | undefined, suffix = "") {
  return value === undefined ? "待采集" : `${compactMetric(value)}${suffix}`;
}

export function CreatorDiscoveryPage() {
  const [data, setData] = useState<CreatorDiscoveryResponse>(emptyResponse);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<ClassFilter>("All");
  const [platformFilter, setPlatformFilter] = useState("All");
  const [approvalBusy, setApprovalBusy] = useState("");

  async function loadCreators() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setData((await response.json()) as CreatorDiscoveryResponse);
    } catch {
      setError(
        "尚未连接本地达人数据服务。运行 npm run creator:studio 后即可读取私有 CRM。",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadCreators(), 0);
    const refresh = window.setInterval(() => void loadCreators(), 60_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(refresh);
    };
  }, []);

  const platforms = useMemo(
    () => [
      "All",
      ...Array.from(new Set(data.creators.map((creator) => creator.platform))),
    ],
    [data.creators],
  );

  const classCounts = useMemo(() => {
    const counts: Record<CreatorClass, number> = { A: 0, B: 0, C: 0 };
    data.creators.forEach((creator) => {
      counts[creatorClassForScore(creator.score)] += 1;
    });
    return counts;
  }, [data.creators]);

  const filteredCreators = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return data.creators.filter((creator) => {
      const creatorClass = creatorClassForScore(creator.score);
      if (classFilter !== "All" && creatorClass !== classFilter) return false;
      if (platformFilter !== "All" && creator.platform !== platformFilter)
        return false;
      if (!normalizedSearch) return true;
      return [
        creator.name,
        creator.handle,
        creator.niche,
        creator.country,
        creator.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [classFilter, data.creators, platformFilter, search]);

  async function updateApproval(
    creator: CreatorDiscoveryRecord,
    decision: "approved" | "rejected",
  ) {
    setApprovalBusy(creator.creatorId);
    setError("");
    try {
      const response = await fetch(
        `${API_URL}/${encodeURIComponent(creator.creatorId)}/approval`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await loadCreators();
    } catch {
      setError("批准状态未保存，请确认本地达人数据服务正在运行。");
    } finally {
      setApprovalBusy("");
    }
  }

  const progress = Math.min(
    100,
    Math.round((data.meta.dailyCollected / data.meta.dailyTarget) * 100),
  );
  const verifiedEmails = data.creators.filter(
    (creator) => creator.isPublicBusinessContact && creator.publicBusinessEmail,
  ).length;

  return (
    <div className="creator-studio">
      <div className="page-header creator-studio-header">
        <div>
          <p className="eyebrow">Capricornus Living · Creator Intelligence</p>
          <h1>达人发现中心</h1>
          <p>
            以 Instagram 为主，查看分类、主页证据、近十篇互动表现与建联状态。
          </p>
        </div>
        <div className="studio-header-actions">
          <span
            className={`sender-gate ${data.meta.senderGate === "ready" ? "ready" : "blocked"}`}
          >
            {data.meta.senderGate === "ready"
              ? "品牌发件身份正常"
              : "发件身份未通过"}
          </span>
          <button type="button" className="secondary" onClick={loadCreators}>
            刷新私有 CRM
          </button>
        </div>
      </div>

      <section className="studio-command-grid" aria-label="达人发现概览">
        <article className="daily-target-card">
          <div>
            <span>今日采集进度</span>
            <strong>
              {data.meta.dailyCollected}
              <small> / {data.meta.dailyTarget}</small>
            </strong>
          </div>
          <div
            className="progress-track"
            aria-label={`今日采集进度 ${progress}%`}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <p>只计入有主页证据、公开商务邮箱来源和验证日期的候选。</p>
        </article>
        <article className="studio-kpi-card">
          <span>公开商务邮箱</span>
          <strong>{verifiedEmails}</strong>
          <small>已去重并核对来源</small>
        </article>
        {(["A", "B", "C"] as CreatorClass[]).map((creatorClass) => (
          <button
            type="button"
            className={`studio-kpi-card class-${creatorClass.toLowerCase()}`}
            key={creatorClass}
            onClick={() => setClassFilter(creatorClass)}
          >
            <span>{creatorClass} 类达人</span>
            <strong>{classCounts[creatorClass]}</strong>
            <small>
              {creatorClass === "A"
                ? "自动建联候选"
                : creatorClass === "B"
                  ? "等待您的批准"
                  : "观察与补数据"}
            </small>
          </button>
        ))}
      </section>

      <section className="studio-safety-strip">
        <div>
          <strong>发件风控</strong>
          <span>
            今日 {data.meta.sentToday}/{data.meta.dailySendCap} 封 ·
            新发件默认每日至多 10 封 · 退信率高于 2% 自动暂停
          </span>
        </div>
        <div>
          <strong>当前发件人</strong>
          <span>{data.meta.senderEmail}</span>
        </div>
        <div>
          <strong>品牌账号</strong>
          <span>{data.meta.socialHandleVerified ? "已核实" : "尚未核实"}</span>
        </div>
      </section>

      <section className="studio-filter-bar" aria-label="达人筛选">
        <label>
          搜索达人、标签或定位
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="例如：midlife、winter style、sustainable living"
          />
        </label>
        <label>
          达人分类
          <select
            value={classFilter}
            onChange={(event) =>
              setClassFilter(event.target.value as ClassFilter)
            }
          >
            <option value="All">全部</option>
            <option value="A">A · 自动建联</option>
            <option value="B">B · 人工选择</option>
            <option value="C">C · 观察</option>
          </select>
        </label>
        <label>
          平台
          <select
            value={platformFilter}
            onChange={(event) => setPlatformFilter(event.target.value)}
          >
            {platforms.map((platform) => (
              <option key={platform}>{platform}</option>
            ))}
          </select>
        </label>
      </section>

      {error && <div className="studio-alert">{error}</div>}
      {loading && data.creators.length === 0 ? (
        <div className="empty-state">正在读取私有达人 CRM…</div>
      ) : filteredCreators.length === 0 ? (
        <div className="empty-state">
          <strong>当前筛选下暂无达人。</strong>
          <span>每日自动采集完成后，新候选会在这里出现。</span>
        </div>
      ) : (
        <section className="creator-card-grid" aria-label="达人卡片">
          {filteredCreators.map((creator) => {
            const creatorClass = creatorClassForScore(creator.score);
            const automaticReady = canQueueAutomaticOutreach(
              creator,
              data.meta.senderGate,
            );
            return (
              <article
                className="creator-intelligence-card"
                key={creator.creatorId}
              >
                <header>
                  <div className="creator-avatar" aria-hidden="true">
                    {(creator.name || creator.handle).slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <span className="creator-platform">{creator.platform}</span>
                    <h2>{creator.name || creator.handle}</h2>
                    <a
                      href={creator.profileUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {creator.handle || "查看主页"} ↗
                    </a>
                  </div>
                  <span
                    className={`creator-class class-${creatorClass.toLowerCase()}`}
                  >
                    {creatorClass}
                  </span>
                </header>

                <div className="creator-score-row">
                  <div>
                    <span>Creator Score</span>
                    <strong>{creator.score}</strong>
                  </div>
                  <div>
                    <span>证据置信度</span>
                    <strong>{creator.confidence}%</strong>
                  </div>
                  <div>
                    <span>地区</span>
                    <strong>{creator.country || "待核实"}</strong>
                  </div>
                </div>

                <div className="creator-tags">
                  {creator.tags.slice(0, 5).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>

                <div className="creator-metric-grid">
                  <span>
                    粉丝数<b>{metricLabel(creator.followers)}</b>
                  </span>
                  <span>
                    近十篇互动率
                    <b>{metricLabel(creator.interactionRate, "%")}</b>
                  </span>
                  <span>
                    平均点赞<b>{metricLabel(creator.averageLikes)}</b>
                  </span>
                  <span>
                    平均评论<b>{metricLabel(creator.averageComments)}</b>
                  </span>
                  <span>
                    平均播放<b>{metricLabel(creator.averageViews)}</b>
                  </span>
                  <span>
                    已分析帖子<b>{creator.postsAnalyzed || "待采集"}</b>
                  </span>
                </div>

                <div className="creator-fit-copy">
                  <strong>{creator.niche || "定位待补充"}</strong>
                  <p>{creatorClassReason(creator)}</p>
                  <small>{creator.recentContent || creator.notes}</small>
                </div>

                <div className="source-links">
                  <a href={creator.profileUrl} target="_blank" rel="noreferrer">
                    打开主页
                  </a>
                  <a
                    href={creator.emailSourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    邮箱来源
                  </a>
                </div>

                <footer>
                  {creatorClass === "A" && (
                    <div
                      className={`automation-state ${automaticReady ? "ready" : "blocked"}`}
                    >
                      <strong>
                        {automaticReady ? "已进入自动建联队列" : "自动建联暂缓"}
                      </strong>
                      <span>
                        {automaticReady
                          ? "系统会遵守每日发件上限与退信暂停规则。"
                          : "等待品牌邮箱、社媒账号或证据门槛通过。"}
                      </span>
                    </div>
                  )}
                  {creatorClass === "B" && (
                    <div className="approval-actions">
                      <button
                        type="button"
                        disabled={approvalBusy === creator.creatorId}
                        onClick={() => updateApproval(creator, "approved")}
                      >
                        批准建联
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={approvalBusy === creator.creatorId}
                        onClick={() => updateApproval(creator, "rejected")}
                      >
                        暂不联系
                      </button>
                      <span>当前：{creator.approvalStatus}</span>
                    </div>
                  )}
                  {creatorClass === "C" && (
                    <div className="automation-state observe">
                      <strong>观察名单</strong>
                      <span>不会自动建联；先补齐近十篇数据与商业表现。</span>
                    </div>
                  )}
                </footer>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
