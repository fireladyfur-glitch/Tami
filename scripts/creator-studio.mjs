/* global URL, console, process */

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadLocalEnvironment() {
  const environmentPath = path.join(root, ".env.creator.local");
  try {
    const text = await fs.readFile(environmentPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator <= 0) continue;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed
        .slice(separator + 1)
        .trim()
        .replace(/^(["'])(.*)\1$/, "$2");
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

await loadLocalEnvironment();

const crmPath = process.env.CREATOR_CRM_PATH;
const port = Number(process.env.CREATOR_STUDIO_API_PORT ?? 4174);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((current) => current.some(Boolean));
}

function csvField(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function stringifyCsv(headers, rows) {
  return (
    [
      headers.map(csvField).join(","),
      ...rows.map((row) =>
        headers.map((header) => csvField(row[header])).join(","),
      ),
    ].join("\r\n") + "\r\n"
  );
}

function rowsFromCsv(text) {
  const matrix = parseCsv(text);
  const headers = matrix[0] ?? [];
  return {
    headers,
    rows: matrix
      .slice(1)
      .map((values) =>
        Object.fromEntries(
          headers.map((header, index) => [header, values[index] ?? ""]),
        ),
      ),
  };
}

function numberOrUndefined(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function booleanValue(value) {
  return String(value).trim().toLowerCase() === "true";
}

function shanghaiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function tagsFor(row) {
  const explicit = String(row.tags ?? "")
    .split(/[|;]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
  const niche = String(row.niche ?? "")
    .split(/\s+(?:and|&)\s+|,/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 2);
  const platform = row.platform ? [row.platform] : [];
  return Array.from(new Set([...explicit, ...niche, ...platform])).slice(0, 8);
}

function interactionRate(row) {
  const explicit = numberOrUndefined(row.last_10_engagement_rate);
  if (explicit !== undefined) return explicit;
  const followers = numberOrUndefined(row.followers);
  const likes = numberOrUndefined(row.last_10_avg_likes);
  const comments = numberOrUndefined(row.last_10_avg_comments);
  if (!followers || (likes === undefined && comments === undefined))
    return undefined;
  return Number(
    ((((likes ?? 0) + (comments ?? 0)) / followers) * 100).toFixed(2),
  );
}

function mapCreator(row) {
  const approval = String(row.approval_status ?? "pending");
  return {
    creatorId: row.creator_id,
    platform: row.platform || "Other",
    handle: row.handle,
    profileUrl: row.profile_url,
    name: row.name,
    country: row.country,
    niche: row.niche,
    recentContent: row.recent_content,
    followers: numberOrUndefined(row.followers),
    publicBusinessEmail: row.public_business_email,
    emailSourceUrl: row.email_source_url,
    publicContactVerifiedAt: row.public_contact_verified_at,
    isPublicBusinessContact: booleanValue(row.is_public_business_contact),
    score: numberOrUndefined(row.score) ?? 0,
    confidence: numberOrUndefined(row.confidence) ?? 0,
    status: row.status,
    tags: tagsFor(row),
    postsAnalyzed: numberOrUndefined(row.posts_analyzed) ?? 0,
    averageLikes: numberOrUndefined(row.last_10_avg_likes),
    averageComments: numberOrUndefined(row.last_10_avg_comments),
    averageViews: numberOrUndefined(row.last_10_avg_views),
    interactionRate: interactionRate(row),
    metricsVerifiedAt: row.metrics_verified_at || undefined,
    approvalStatus: ["approved", "rejected"].includes(approval)
      ? approval
      : "pending",
    approvalUpdatedAt: row.approval_updated_at || undefined,
    notes: row.notes,
  };
}

function sendJson(response, status, payload, origin) {
  if (origin === "http://localhost:5173" || origin === "http://127.0.0.1:5173")
    response.setHeader("Access-Control-Allow-Origin", origin);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

async function readCrm() {
  if (!crmPath)
    throw new Error("CREATOR_CRM_PATH is not configured in .env.creator.local");
  return rowsFromCsv(await fs.readFile(crmPath, "utf8"));
}

async function getDiscoveryPayload() {
  const { rows } = await readCrm();
  const today = shanghaiDate();
  const creators = rows.map(mapCreator);
  return {
    creators,
    meta: {
      generatedAt: new Date().toISOString(),
      dailyTarget: Number(process.env.CREATOR_DAILY_TARGET ?? 100),
      dailyCollected: creators.filter(
        (creator) => creator.publicContactVerifiedAt === today,
      ).length,
      senderGate:
        process.env.CAPRICORNUS_SENDER_GATE === "ready" ? "ready" : "blocked",
      senderEmail: process.env.CAPRICORNUS_SENDER_EMAIL ?? "not connected",
      socialHandleVerified:
        process.env.CAPRICORNUS_SOCIAL_HANDLE_VERIFIED === "true",
      dailySendCap: Number(process.env.CREATOR_DAILY_SEND_CAP ?? 10),
      sentToday: Number(process.env.CREATOR_SENT_TODAY ?? 0),
    },
  };
}

async function updateApproval(creatorId, decision) {
  if (!crmPath) throw new Error("CREATOR_CRM_PATH is not configured");
  const { headers, rows } = await readCrm();
  const row = rows.find((candidate) => candidate.creator_id === creatorId);
  if (!row) return false;
  for (const header of ["approval_status", "approval_updated_at"])
    if (!headers.includes(header)) headers.push(header);
  row.approval_status = decision;
  row.approval_updated_at = new Date().toISOString();

  const timestamp = new Date().toISOString().replaceAll(":", "-");
  await fs.copyFile(crmPath, `${crmPath}.before_approval_${timestamp}.bak`);
  const temporaryPath = `${crmPath}.tmp`;
  await fs.writeFile(temporaryPath, stringifyCsv(headers, rows), "utf8");
  await fs.rename(temporaryPath, crmPath);
  return true;
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (request.method === "OPTIONS") {
    if (
      origin === "http://localhost:5173" ||
      origin === "http://127.0.0.1:5173"
    )
      response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Methods", "GET,PATCH,OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    response.writeHead(204);
    response.end();
    return;
  }
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
    if (request.method === "GET" && url.pathname === "/api/creator-discovery") {
      sendJson(response, 200, await getDiscoveryPayload(), origin);
      return;
    }
    const approvalMatch = url.pathname.match(
      /^\/api\/creator-discovery\/([^/]+)\/approval$/,
    );
    if (request.method === "PATCH" && approvalMatch) {
      let body = "";
      for await (const chunk of request) body += chunk;
      const { decision } = JSON.parse(body || "{}");
      if (!["approved", "rejected"].includes(decision)) {
        sendJson(response, 400, { error: "Invalid approval decision" }, origin);
        return;
      }
      const updated = await updateApproval(
        decodeURIComponent(approvalMatch[1]),
        decision,
      );
      sendJson(response, updated ? 200 : 404, { ok: updated }, origin);
      return;
    }
    sendJson(response, 404, { error: "Not found" }, origin);
  } catch (error) {
    sendJson(response, 500, { error: error.message }, origin);
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Private creator CRM API: http://127.0.0.1:${port}`);
});

const vitePath = path.join(root, "node_modules", "vite", "bin", "vite.js");
const vite = spawn(
  process.execPath,
  [vitePath, "--host", "0.0.0.0", "--port", "5173", "--strictPort"],
  {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  },
);

function shutdown() {
  vite.kill();
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
vite.on("exit", (code) => {
  server.close();
  process.exit(code ?? 0);
});
