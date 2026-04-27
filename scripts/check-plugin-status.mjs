import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const indexPath = path.join(repoRoot, "index.json");
const readmePath = path.join(repoRoot, "README.md");
const docsDir = path.join(repoRoot, "docs");
const docsJsonPath = path.join(docsDir, "plugin-status.json");

const README_START = "<!-- plugin-status:start -->";
const README_END = "<!-- plugin-status:end -->";

const REQUEST_TIMEOUT_MS = 15000;
const MAX_TARGETS_PER_PLUGIN = 2;
const MAX_CONCURRENCY = 6;
const SELF_HOSTED_KEYS = new Set(["kavita", "komga", "lanraragi"]);

const STATUS_PRIORITY = {
  reachable: 4,
  limited: 3,
  offline: 2,
  error: 1,
  self_hosted: 0,
  unconfigured: 0,
};

const EXCLUDED_HOSTS = new Set([
  "cdn.jsdelivr.net",
  "raw.githubusercontent.com",
  "github.com",
  "www.github.com",
  "itunes.apple.com",
  "storage.googleapis.com",
  "localhost",
]);

const MANUAL_TARGETS = {
  baihehui: {
    note: "Using the public site as the probe target.",
    targets: ["https://www.yamibo.com/site/manga"],
  },
  baozi: {
    note: "Uses the default public domain from plugin settings.",
    targets: ["https://cn.bzmgcn.com/"],
  },
  copy_manga: {
    targets: [
      "https://www.2026copy.com/",
      "https://api.mangacopy.com/api/v3/system/network2?platform=2",
    ],
  },
  ehentai: {
    note: "Forum and main site are checked as a lightweight availability proxy.",
    targets: [
      "https://e-hentai.org/news.php",
      "https://forums.e-hentai.org/index.php?act=Login&CODE=00",
    ],
  },
  goda: {
    note: "Uses the default public site and API hosts from plugin settings.",
    targets: ["https://godamh.com/", "https://api-get-v3.mgsearcher.com/api"],
  },
  hitomi: {
    note: "Checks the public frontend and tag index host.",
    targets: ["https://hitomi.la/", "https://tagindex.hitomi.la/"],
  },
  jm: {
    note: "JM domains are refreshed dynamically; probe uses the built-in fallback host and image CDN.",
    targets: ["https://www.cdntwice.org/", "https://cdn-msp.jmapinodeudzn.net/"],
  },
  manga_dex: {
    targets: ["https://mangadex.org/", "https://api.mangadex.org/"],
  },
  mangaplus: {
    targets: ["https://mangaplus.shueisha.co.jp/", "https://jumpg-webapi.tokyo-cdn.com/api/title_list/ranking?format=json&rankingType=0"],
  },
  manwaba: {
    targets: ["https://www.mhtmh.org/", "https://www.mhtmh.org/api/home"],
  },
  zaimanhua: {
    targets: ["https://v4api.zaimanhua.com/", "https://i.zaimanhua.com/"],
  },
};

async function main() {
  await fs.mkdir(docsDir, { recursive: true });

  const plugins = JSON.parse(await fs.readFile(indexPath, "utf8"));
  const generatedAt = new Date().toISOString();

  const pluginResults = await mapWithConcurrency(
    plugins,
    MAX_CONCURRENCY,
    async (plugin) => inspectPlugin(plugin, generatedAt),
  );

  pluginResults.sort((a, b) => {
    const priorityDiff = STATUS_PRIORITY[b.status] - STATUS_PRIORITY[a.status];
    if (priorityDiff !== 0) return priorityDiff;
    return a.key.localeCompare(b.key, "en");
  });

  const summary = buildSummary(pluginResults);
  const payload = {
    generatedAt,
    summary,
    plugins: pluginResults,
  };

  await fs.writeFile(docsJsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await updateReadme(payload);
}

async function inspectPlugin(plugin, generatedAt) {
  const sourcePath = path.join(repoRoot, plugin.fileName);
  const source = await fs.readFile(sourcePath, "utf8");

  if (SELF_HOSTED_KEYS.has(plugin.key)) {
    return {
      ...plugin,
      generatedAt,
      status: "self_hosted",
      httpStatus: null,
      durationMs: null,
      probeUrl: null,
      note: "Self-hosted plugin. No public instance is checked by default; set a manual target in scripts/check-plugin-status.mjs if you want to monitor one.",
    };
  }

  const targets = resolveTargets(plugin, source);

  if (targets.length === 0) {
    return {
      ...plugin,
      generatedAt,
      status: "unconfigured",
      httpStatus: null,
      durationMs: null,
      probeUrl: null,
      note: "No stable probe target could be derived from the plugin source.",
    };
  }

  const attempts = [];
  for (const target of targets) {
    const result = await probeUrl(target);
    attempts.push(result);
    if (result.status === "reachable" || result.status === "limited") {
      break;
    }
  }

  const bestAttempt = chooseBestAttempt(attempts);
  const manualNote = MANUAL_TARGETS[plugin.key]?.note;
  const notes = [manualNote, bestAttempt.note].filter(Boolean).join(" ");

  return {
    ...plugin,
    generatedAt,
    status: bestAttempt.status,
    httpStatus: bestAttempt.httpStatus,
    durationMs: bestAttempt.durationMs,
    probeUrl: bestAttempt.url,
    note: notes || null,
  };
}

function resolveTargets(plugin, source) {
  const manual = MANUAL_TARGETS[plugin.key]?.targets ?? [];
  const auto = extractAutoTargets(source);
  const merged = [];
  for (const value of [...manual, ...auto]) {
    const normalized = normalizeUrl(value);
    if (!normalized) continue;
    if (!merged.includes(normalized)) {
      merged.push(normalized);
    }
    if (merged.length >= MAX_TARGETS_PER_PLUGIN) {
      break;
    }
  }
  return merged;
}

function extractAutoTargets(source) {
  const scored = new Map();
  const lines = source.split(/\r?\n/);

  const defaults = extractSettingDefaults(source);
  for (const url of deriveUrlsFromSettings(source, defaults)) {
    addCandidate(scored, url, 70);
  }

  for (const line of lines) {
    const rawUrls = [...line.matchAll(/https?:\/\/[^\s"'`)<]+/g)].map((match) => match[0]);
    if (rawUrls.length === 0) continue;

    let score = 20;
    if (/\b(baseUrl|apiUrl|api_base|registerWebsite|loginWithWebview|origin|referer)\b/i.test(line)) {
      score += 35;
    }
    if (/\b(API|defaultApiUrl)\b/.test(line)) {
      score += 30;
    }
    if (/Network\.(get|post|put|fetch)/.test(line)) {
      score += 10;
    }

    for (const rawUrl of rawUrls) {
      const normalized = normalizeUrl(rawUrl);
      if (!normalized) continue;

      let finalScore = score;
      if (/\/api(?:\/|$)/i.test(normalized)) finalScore += 10;
      if (/\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(normalized)) finalScore -= 50;
      if (/\.js(\?|$)/i.test(normalized)) finalScore -= 40;
      addCandidate(scored, normalized, finalScore);
    }
  }

  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([url]) => url)
    .slice(0, MAX_TARGETS_PER_PLUGIN);
}

function extractSettingDefaults(source) {
  const defaults = new Map();
  const blockRegex = /(\w+)\s*:\s*{[\s\S]{0,250}?default\s*:\s*["']([^"']+)["']/g;
  for (const match of source.matchAll(blockRegex)) {
    defaults.set(match[1], match[2]);
  }
  return defaults;
}

function deriveUrlsFromSettings(source, defaults) {
  const urls = [];

  for (const match of source.matchAll(/return\s+`https:\/\/\$\{this\.loadSetting\("([^"]+)"\)\}`/g)) {
    const value = defaults.get(match[1]);
    if (value) urls.push(`https://${value}`);
  }

  for (const match of source.matchAll(/return\s+`https:\/\/\$\{this\.loadSetting\("([^"]+)"\)\}\/([^`]+)`/g)) {
    const value = defaults.get(match[1]);
    if (value) urls.push(`https://${value}/${match[2]}`);
  }

  for (const match of source.matchAll(/defaultApiUrl\s*=\s*["']([^"']+)["']/g)) {
    urls.push(`https://${match[1]}`);
  }

  for (const match of source.matchAll(/return\s+["']https:\/\/([^"']+)["']/g)) {
    urls.push(`https://${match[1]}`);
  }

  for (const match of source.matchAll(/baseUrl\s*=\s*["'](https?:\/\/[^"']+)["']/g)) {
    urls.push(match[1]);
  }

  for (const match of source.matchAll(/apiUrl\s*=\s*["'](https?:\/\/[^"']+)["']/g)) {
    urls.push(match[1]);
  }

  return urls;
}

function addCandidate(map, url, score) {
  const existing = map.get(url) ?? -Infinity;
  if (score > existing) {
    map.set(url, score);
  }
}

function normalizeUrl(input) {
  if (!input) return null;

  let value = input.trim();
  if (value.includes("${")) return null;
  value = value.replace(/[),.;]+$/, "");
  value = value.replace(/\$\{[^}]+\}/g, "");
  if (!/^https?:\/\//i.test(value)) return null;

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (!parsed.hostname || EXCLUDED_HOSTS.has(parsed.hostname)) {
    return null;
  }

  if (parsed.hostname.endsWith(".githubusercontent.com")) {
    return null;
  }

  if (!parsed.pathname || parsed.pathname === "") {
    parsed.pathname = "/";
  }

  return parsed.toString();
}

async function probeUrl(url) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let response;
    try {
      response = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
        headers: { "user-agent": "EZVenera plugin status bot/1.0" },
      });
    } catch {
      response = null;
    }

    if (response === null || response.status === 405 || response.status === 501) {
      response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { "user-agent": "EZVenera plugin status bot/1.0" },
      });
    }

    const durationMs = Date.now() - started;
    const status = classifyHttpStatus(response.status);
    const note =
      status === "limited"
        ? "Endpoint responded but may be rate-limited or access-controlled."
        : null;

    return {
      url,
      status,
      httpStatus: response.status,
      durationMs,
      note,
    };
  } catch (error) {
    const durationMs = Date.now() - started;
    const message = error?.name === "AbortError" ? "Request timed out." : String(error?.message ?? error);
    return {
      url,
      status: "error",
      httpStatus: null,
      durationMs,
      note: message,
    };
  } finally {
    clearTimeout(timer);
  }
}

function classifyHttpStatus(code) {
  if (code >= 200 && code < 400) return "reachable";
  if (code === 401 || code === 403 || code === 429) return "limited";
  if (code >= 500) return "offline";
  return "error";
}

function chooseBestAttempt(attempts) {
  if (attempts.length === 0) {
    return {
      url: null,
      status: "unconfigured",
      httpStatus: null,
      durationMs: null,
      note: "No probe attempt was made.",
    };
  }

  return attempts.slice().sort((a, b) => {
    const statusDiff = STATUS_PRIORITY[b.status] - STATUS_PRIORITY[a.status];
    if (statusDiff !== 0) return statusDiff;
    return (a.durationMs ?? Infinity) - (b.durationMs ?? Infinity);
  })[0];
}

function buildSummary(plugins) {
  const summary = {
    total: plugins.length,
    reachable: 0,
    limited: 0,
    offline: 0,
    error: 0,
    self_hosted: 0,
    unconfigured: 0,
  };

  for (const plugin of plugins) {
    summary[plugin.status] += 1;
  }

  return summary;
}

async function updateReadme(payload) {
  let readme = await fs.readFile(readmePath, "utf8");

  if (!readme.includes(README_START) || !readme.includes(README_END)) {
    const insertion = [
      "",
      "## Plugin Status",
      "",
      `${README_START}`,
      `${README_END}`,
      "",
    ].join("\n");

    if (readme.includes("# EZVenera-config")) {
      readme = readme.replace("# EZVenera-config", `# EZVenera-config${insertion}`);
    } else {
      readme = `${insertion}\n${readme}`;
    }
  }

  const generatedAt = formatUtc(payload.generatedAt);
  const lines = [
    README_START,
    `Last updated: ${generatedAt} UTC`,
    "",
    `Summary: ${payload.summary.reachable} reachable, ${payload.summary.limited} limited, ${payload.summary.offline} offline, ${payload.summary.error} error, ${payload.summary.self_hosted} self-hosted, ${payload.summary.unconfigured} unconfigured.`,
    "",
    "Live dashboard: https://wep-56.github.io/EZvenera-config/",
    "",
    "| Plugin | Version | Status | HTTP | Probe | Note |",
    "| --- | --- | --- | --- | --- | --- |",
    ...payload.plugins.map((plugin) => {
      const probe = plugin.probeUrl ? formatMarkdownLink(shortenUrl(plugin.probeUrl), plugin.probeUrl) : "-";
      return [
        plugin.key,
        plugin.version ?? "-",
        plugin.status,
        plugin.httpStatus ?? "-",
        probe,
        escapeTable(plugin.note ?? "-"),
      ].map(escapeTable).join(" | ");
    }).map((row) => `| ${row} |`),
    README_END,
  ];

  const pattern = new RegExp(`${escapeRegExp(README_START)}[\\s\\S]*?${escapeRegExp(README_END)}`);
  readme = readme.replace(pattern, lines.join("\n"));
  await fs.writeFile(readmePath, readme, "utf8");
}

function formatUtc(value) {
  return value.replace(/\.\d{3}Z$/, "Z");
}

function shortenUrl(value) {
  try {
    const url = new URL(value);
    const pathName = url.pathname.length > 1 ? url.pathname : "";
    return `${url.hostname}${pathName}`;
  } catch {
    return value;
  }
}

function formatMarkdownLink(label, url) {
  return `[${label}](${url})`;
}

function escapeTable(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function mapWithConcurrency(items, concurrency, iteratee) {
  const results = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (currentIndex < items.length) {
      const index = currentIndex;
      currentIndex += 1;
      results[index] = await iteratee(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
