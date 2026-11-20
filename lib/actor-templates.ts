import { ERC8004_IDENTITY_REGISTRY } from "@/lib/facet-ui";

export interface ActorTemplatePreset {
  id: string;
  label: string;
  facetDisplayName: string;
  facetName: string;
  summary: string;
  category: string;
  tags: string[];
  description: string;
  pricingModel: "PAY_PER_RUN" | "PAY_PER_RESULT";
  priceAtomic: string;
  inputSchema: Record<string, unknown>;
  code: string;
}

export const BLANK_ACTOR_PRESET: ActorTemplatePreset = {
  id: "blank-actor",
  label: "Blank Actor",
  facetDisplayName: "",
  facetName: "",
  summary: "",
  category: "",
  tags: [],
  description: "",
  pricingModel: "PAY_PER_RUN",
  priceAtomic: "1000",
  inputSchema: {
    type: "object",
    properties: {},
  },
  code: "",
};

export const ACTOR_TEMPLATE_PRESETS: ActorTemplatePreset[] = [
  {
    id: "html-structured-extractor",
    label: "HTML Structured Extractor",
    facetDisplayName: "HTML Structured Extractor",
    facetName: "html-structured-extractor",
    summary:
      "Extracts deduplicated links, tables, headings, or CSS-selected elements from raw HTML into a clean Dataset.",
    category: "web-scraping",
    tags: ["html", "cheerio", "scraping", "extraction"],
    description:
      "Parses raw HTML inside the isolated Cheerio runner and extracts clean links with resolved URLs, structured table rows, heading outlines, or custom CSS selector matches.",
    pricingModel: "PAY_PER_RESULT",
    priceAtomic: "500",
    inputSchema: {
      type: "object",
      required: ["html"],
      properties: {
        html: {
          type: "string",
          default:
            '<main><h1>FACET Capability Index</h1><p>Explore sandboxed tools.</p><a href="/docs">Documentation</a> <a href="https://avax.network/developers" rel="noopener">Avalanche Developers</a><table><thead><tr><th>Tool</th><th>Category</th><th>LatencyMs</th></tr></thead><tbody><tr><td>HTML Structured Extractor</td><td>web-scraping</td><td>42</td></tr><tr><td>PII &amp; Secret Redactor</td><td>data-processing</td><td>18</td></tr></tbody></table></main>',
          description: "Raw HTML document or fragment fetched by the agent",
        },
        mode: {
          type: "string",
          enum: ["links", "tables", "headings", "selector"],
          default: "links",
          description:
            "Extraction target: links, tables, headings, or selector",
        },
        baseUrl: {
          type: "string",
          default: "https://facet.briandev.space",
          description: "Optional base URL used to resolve relative href links",
        },
        selector: {
          type: "string",
          default: "a, h1, h2",
          description: "CSS selector applied when mode is set to selector",
        },
        limit: {
          type: "integer",
          default: 20,
          minimum: 1,
          maximum: 100,
          description: "Maximum number of extracted dataset items",
        },
      },
    },
    code: `import * as cheerio from "cheerio";

export default async function run(input) {
  const html = typeof input?.html === "string" ? input.html.trim() : "";
  if (!html) {
    throw new Error("Input 'html' must be a non-empty HTML string.");
  }

  const mode = String(input?.mode ?? "links").toLowerCase();
  const baseUrl =
    typeof input?.baseUrl === "string" && input.baseUrl.trim()
      ? input.baseUrl.trim()
      : "";
  const limit = Math.min(Math.max(Number(input?.limit ?? 20) || 20, 1), 100);
  const clean = (value) => String(value ?? "").replace(/\\s+/g, " ").trim();

  let baseHost = null;
  if (baseUrl) {
    try {
      baseHost = new URL(baseUrl).hostname.toLowerCase();
    } catch {
      baseHost = null;
    }
  }

  const resolveUrl = (href) => {
    const raw = clean(href);
    if (!raw || raw.startsWith("#") || /^(?:javascript|data):/i.test(raw)) {
      return null;
    }
    try {
      const parsed = baseUrl ? new URL(raw, baseUrl) : new URL(raw);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return null;
      }
      const domain = parsed.hostname.toLowerCase();
      return {
        url: parsed.href,
        domain,
        isExternal: baseHost ? domain !== baseHost : null,
      };
    } catch {
      return { url: raw, domain: null, isExternal: null };
    }
  };

  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  if (mode === "links") {
    const seen = new Set();
    const rows = [];
    $("a[href]").each((_, el) => {
      if (rows.length >= limit) return false;
      const resolved = resolveUrl($(el).attr("href"));
      if (!resolved || seen.has(resolved.url)) return;
      seen.add(resolved.url);
      rows.push({
        index: rows.length + 1,
        text: clean($(el).text()) || clean($(el).attr("aria-label")) || null,
        url: resolved.url,
        domain: resolved.domain,
        isExternal: resolved.isExternal,
        rel: clean($(el).attr("rel")) || null,
      });
    });
    return rows;
  }

  if (mode === "tables") {
    const rows = [];
    $("table").each((tableIdx, tableEl) => {
      if (rows.length >= limit) return false;
      const $table = $(tableEl);
      const $theadRows = $table.find("thead tr");
      const $headerRow =
        $theadRows.length > 0
          ? $theadRows.first()
          : $table.find("tr").first().find("th").length > 0
            ? $table.find("tr").first()
            : null;
      const headerNode = $headerRow ? $headerRow.get(0) : null;
      const headers = [];
      const usedKeys = new Set(["tableIndex", "rowIndex"]);
      if ($headerRow) {
        $headerRow.find("th, td").each((colIdx, cell) => {
          let key = clean($(cell).text()) || \`col_\${colIdx + 1}\`;
          while (usedKeys.has(key)) {
            key = \`\${key}_\${colIdx + 1}\`;
          }
          usedKeys.add(key);
          headers.push(key);
        });
      }

      const $candidateRows =
        $theadRows.length > 0 && $table.find("tbody tr").length > 0
          ? $table.find("tbody tr")
          : $table.find("tr");

      let rowIndex = 0;
      $candidateRows.each((_, trEl) => {
        if (rows.length >= limit) return false;
        if (trEl === headerNode) return;
        const cells = $(trEl)
          .find("td, th")
          .toArray()
          .map((cell) => clean($(cell).text()));
        if (cells.length === 0 || cells.every((c) => !c)) return;
        rowIndex += 1;
        const record = { tableIndex: tableIdx + 1, rowIndex };
        cells.forEach((value, idx) => {
          const colKey = headers[idx] ?? \`col_\${idx + 1}\`;
          record[colKey] = value;
        });
        rows.push(record);
      });
    });
    return rows;
  }

  if (mode === "headings") {
    const rows = [];
    $("h1, h2, h3, h4").each((_, el) => {
      if (rows.length >= limit) return false;
      const tag = String(el.tagName ?? el.name ?? "h1").toLowerCase();
      const text = clean($(el).text());
      if (!text) return;
      rows.push({
        index: rows.length + 1,
        level: Number(tag.slice(1)) || 1,
        text,
        id: clean($(el).attr("id")) || null,
        snippet: clean($(el).next("p").text()).slice(0, 200) || null,
      });
    });
    return rows;
  }

  if (mode === "selector") {
    const selector = clean(input?.selector) || "article, h1, h2, a";
    const rows = [];
    $(selector).each((_, el) => {
      if (rows.length >= limit) return false;
      const tag = String(el.tagName ?? el.name ?? "element").toLowerCase();
      const resolved = resolveUrl($(el).attr("href"));
      rows.push({
        index: rows.length + 1,
        tag,
        text: clean($(el).text()).slice(0, 500),
        href: resolved?.url ?? null,
        id: clean($(el).attr("id")) || null,
        className: clean($(el).attr("class")) || null,
      });
    });
    return rows;
  }

  throw new Error(
    \`Unsupported mode "\${mode}". Use links, tables, headings, or selector.\`,
  );
}`,
  },
  {
    id: "pii-secret-redactor",
    label: "PII & Secret Redactor",
    facetDisplayName: "PII & Secret Redactor",
    facetName: "pii-secret-redactor",
    summary:
      "Detects and redacts emails, phones, Luhn-valid cards, IPs, JWTs, API keys, and private keys offline.",
    category: "data-processing",
    tags: ["pii", "security", "redaction", "compliance"],
    description:
      "Scans text records inside an air-gapped (--network=none) container to mask, deterministically pseudonymize via SHA-256, or audit sensitive PII and leaked credentials.",
    pricingModel: "PAY_PER_RUN",
    priceAtomic: "1000",
    inputSchema: {
      type: "object",
      required: ["records"],
      properties: {
        records: {
          type: "array",
          default: [
            {
              id: "ticket-101",
              text: "Contact alice@acme.dev or +1 (415) 555-0192 from 10.24.8.15 regarding invoice.",
            },
            {
              id: "log-204",
              text: "Leaked token Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEifQ.demoSig123456 and key sk-example-9876543210abcd.",
            },
          ],
          description: "Array of { id, text } objects to scan and sanitize",
          items: {
            type: "object",
            required: ["text"],
          },
        },
        mode: {
          type: "string",
          enum: ["mask", "pseudonymize", "audit"],
          default: "mask",
          description:
            "mask replaces with [TYPE], pseudonymize uses deterministic SHA-256 tags, audit reports without modifying text",
        },
        salt: {
          type: "string",
          default: "agent-session-v1",
          description:
            "Optional salt mixed into SHA-256 tokens when mode is pseudonymize",
        },
        redactPrivateKeys: {
          type: "boolean",
          default: true,
          description: "Detect and redact 64-hex EVM private keys (0x...)",
        },
      },
    },
    code: `import { createHash } from "node:crypto";

function isValidLuhn(raw) {
  const digits = raw.replace(/\\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let doubleNext = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number(digits[i]);
    if (doubleNext) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    doubleNext = !doubleNext;
  }
  return sum % 10 === 0;
}

export default async function run(input) {
  const records = Array.isArray(input?.records) ? input.records : [];
  if (records.length === 0) {
    throw new Error(
      "Input 'records' must be a non-empty array of { id, text } objects.",
    );
  }

  const mode = String(input?.mode ?? "mask").toLowerCase();
  if (!["mask", "pseudonymize", "audit"].includes(mode)) {
    throw new Error(
      \`Unsupported mode "\${mode}". Use mask, pseudonymize, or audit.\`,
    );
  }

  const salt = typeof input?.salt === "string" ? input.salt : "";
  const redactPrivateKeys = input?.redactPrivateKeys !== false;

  const detectors = [
    {
      type: "JWT",
      priority: 1,
      regex:
        /\\beyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\b/g,
    },
    ...(redactPrivateKeys
      ? [
          {
            type: "PRIVATE_KEY",
            priority: 2,
            regex: /\\b0x[a-fA-F0-9]{64}\\b/g,
          },
        ]
      : []),
    {
      type: "API_KEY",
      priority: 3,
      regex: /\\b(?:sk|pk|rk|ghp|gho|xoxb|xoxp|AKIA)[-_A-Za-z0-9]{12,}\\b/g,
    },
    {
      type: "EMAIL",
      priority: 4,
      regex: /\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b/g,
    },
    {
      type: "CARD",
      priority: 5,
      regex: /\\b\\d(?:[ -]?\\d){12,18}\\b/g,
      validate: (match) => isValidLuhn(match),
    },
    {
      type: "IPV4",
      priority: 6,
      regex:
        /\\b(?:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\b/g,
    },
    {
      type: "PHONE",
      priority: 7,
      regex:
        /(?<![\\w]|\\d[-.])(?:\\+?\\d{1,3}[\\s.-]?)?(?:\\(\\d{2,4}\\)|\\d{2,4})[\\s.-]\\d{3,4}[\\s.-]\\d{3,4}(?![\\w]|[-.]\\d)/g,
      validate: (match) => {
        const digits = match.replace(/\\D/g, "");
        return digits.length >= 9 && digits.length <= 15;
      },
    },
  ];

  const HIGH_RISK = new Set(["PRIVATE_KEY", "API_KEY", "JWT", "CARD"]);

  return records.slice(0, 100).map((item, idx) => {
    if (!item || typeof item.text !== "string") {
      throw new Error(
        \`Record at index \${idx} must include a string 'text' field.\`,
      );
    }
    const text = item.text;
    const candidates = [];

    for (const detector of detectors) {
      for (const m of text.matchAll(detector.regex)) {
        const value = m[0];
        if (m.index === undefined) continue;
        if (detector.validate && !detector.validate(value)) continue;
        candidates.push({
          type: detector.type,
          priority: detector.priority,
          start: m.index,
          end: m.index + value.length,
          value,
        });
      }
    }

    candidates.sort(
      (a, b) =>
        a.start - b.start ||
        a.priority - b.priority ||
        b.end - b.start - (a.end - a.start),
    );

    const accepted = [];
    let cursor = 0;
    for (const span of candidates) {
      if (span.start < cursor) continue;
      accepted.push(span);
      cursor = span.end;
    }

    const counts = new Map();
    let out = "";
    let pos = 0;
    for (const span of accepted) {
      counts.set(span.type, (counts.get(span.type) ?? 0) + 1);
      if (mode !== "audit") {
        out += text.slice(pos, span.start);
        if (mode === "pseudonymize") {
          const digest = createHash("sha256")
            .update(\`\${salt}:\${span.type}:\${span.value}\`)
            .digest("hex")
            .slice(0, 8);
          out += \`[\${span.type}:\${digest}]\`;
        } else {
          out += \`[\${span.type}]\`;
        }
        pos = span.end;
      }
    }
    const sanitizedText = mode === "audit" ? text : out + text.slice(pos);
    const categories = [...counts.keys()];
    const riskLevel =
      accepted.length === 0
        ? "NONE"
        : categories.some((cat) => HIGH_RISK.has(cat))
          ? "HIGH"
          : "MEDIUM";

    return {
      id: String(item.id ?? \`record-\${idx + 1}\`),
      sanitizedText,
      hasPii: accepted.length > 0,
      findingCount: accepted.length,
      riskLevel,
      categories,
      counts: Object.fromEntries(counts),
    };
  });
}`,
  },
];

export interface AgentTemplatePreset {
  id: string;
  label: string;
  facetDisplayName: string;
  facetName: string;
  summary: string;
  category: string;
  tags: string[];
  description: string;
  erc8004TokenId: string;
  erc8004Registry: string;
  taskKind: string;
  pricingModel: "PAY_PER_RUN" | "PAY_PER_RESULT";
  priceAtomic: string;
  inputSchema: Record<string, unknown>;
}

export const AGENT_TEMPLATE_PRESET: AgentTemplatePreset = {
  id: "vn-market-analyst-agent",
  label: "VN Market & Macro Analyst",
  facetDisplayName: "VN Market & Macro Analyst",
  facetName: "vn-market-analyst-agent",
  summary:
    "Verified on-chain Agent synthesizing sourced Vietnamese gold, FX, and news datasets.",
  category: "a2a-agents",
  tags: ["vietnam", "agent", "macro"],
  description:
    "Agent định danh on-chain trên Avalanche, tự động tổng hợp dữ liệu vàng, tỷ giá và tin tức Việt Nam thành báo cáo phân tích có trích dẫn nguồn.",
  erc8004TokenId: "1",
  erc8004Registry: ERC8004_IDENTITY_REGISTRY,
  taskKind: "vn-market-analysis",
  pricingModel: "PAY_PER_RUN",
  priceAtomic: "1000",
  inputSchema: {
    type: "object",
    required: ["question", "goldQuotes", "articles"],
    properties: {
      question: {
        type: "string",
        default:
          "Phân tích xu hướng giá vàng SJC và fintech Việt Nam từ dữ liệu có nguồn",
        description: "Câu hỏi hoặc nhiệm vụ giao cho Agent",
      },
      goldQuotes: {
        type: "array",
        default: [
          {
            brand: "SJC",
            buyVnd: 88500000,
            sellVnd: 91000000,
            asOf: "2026-11-16T08:00:00Z",
            sourceUrl: "https://sjc.com.vn/gia-vang-online",
          },
        ],
        description:
          "Sourced gold quote records (brand, buyVnd, sellVnd, asOf, sourceUrl)",
        items: {
          type: "object",
          required: ["brand", "buyVnd", "sellVnd", "asOf", "sourceUrl"],
        },
      },
      articles: {
        type: "array",
        default: [
          {
            title: "Hệ sinh thái thanh toán x402 mở rộng ứng dụng AI Agent",
            text: "Thanh toán vi mô tức thì trên Avalanche giúp fintech tăng trưởng tích cực.",
            sourceUrl: "https://vneconomy.vn/fintech-x402",
            asOf: "2026-11-16T08:00:00Z",
          },
        ],
        description: "Sourced news articles (title, text, sourceUrl, asOf)",
        items: {
          type: "object",
          required: ["title", "text", "sourceUrl", "asOf"],
        },
      },
      focus: {
        type: "string",
        enum: ["COMPREHENSIVE", "GOLD_FX", "TECH_NEWS"],
        default: "COMPREHENSIVE",
        description: "Trọng tâm phân tích",
      },
    },
  },
};

export const CUSTOM_AGENT_PRESET: AgentTemplatePreset = {
  id: "custom-agent",
  label: "Custom Agent",
  facetDisplayName: "Custom Agent",
  facetName: "custom-agent",
  summary: "On-chain Agent ready for verifiable x402 task delegation.",
  category: "a2a-agents",
  tags: ["agent", "fusd"],
  description:
    "Autonomous Agent anchored to an Avalanche on-chain identity token.",
  erc8004TokenId: "1",
  erc8004Registry: ERC8004_IDENTITY_REGISTRY,
  taskKind: "vn-market-analysis",
  pricingModel: "PAY_PER_RUN",
  priceAtomic: "1000",
  inputSchema: {
    type: "object",
    required: ["question"],
    properties: {
      question: {
        type: "string",
        default: "Summarize sourced records",
        description: "Task prompt sent to the A2A agent",
      },
    },
  },
};
