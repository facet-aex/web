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
  facetDisplayName: "Custom Data Actor",
  facetName: "custom-data-actor",
  summary: "Transforms structured JSON input into normalized Dataset rows.",
  category: "data-processing",
  tags: ["actor", "docker", "dataset"],
  description:
    "Node.js 22 Actor running inside an isolated container returning structured Dataset items.",
  pricingModel: "PAY_PER_RUN",
  priceAtomic: "1000",
  inputSchema: {
    type: "object",
    required: ["query"],
    properties: {
      query: {
        type: "string",
        default: "avalanche fuji",
        description: "Primary task input parameter",
      },
      limit: {
        type: "integer",
        default: 5,
        description: "Maximum items to return",
      },
    },
  },
  code: `export default async function run(input) {
  const query = String(input?.query ?? "facet").trim();
  const limit = Math.min(Math.max(Number(input?.limit ?? 5), 1), 50);
  return Array.from({ length: Math.min(limit, 3) }, (_, index) => ({
    index: index + 1,
    query,
    status: "ok",
    processedAt: new Date().toISOString(),
  }));
}`,
};

export const ACTOR_TEMPLATE_PRESETS: ActorTemplatePreset[] = [
  {
    id: "vn-gold-fx-actor",
    label: "VN Gold & FX Scraper",
    facetDisplayName: "VN Gold & FX Scraper",
    facetName: "vn-gold-fx-actor",
    summary:
      "Normalizes SJC, DOJI, and PNJ gold quotes with VND FX rates into a Dataset.",
    category: "vietnamese-data",
    tags: ["vietnam", "gold", "fx", "actor"],
    description:
      "Thu thập và chuẩn hóa bảng giá vàng SJC/DOJI/PNJ cùng tỷ giá VND thành Dataset có cấu trúc.",
    pricingModel: "PAY_PER_RUN",
    priceAtomic: "1000",
    inputSchema: {
      type: "object",
      properties: {
        brand: {
          type: "string",
          enum: ["ALL", "SJC", "DOJI", "PNJ"],
          default: "ALL",
          description: "Thương hiệu vàng cần lấy dữ liệu",
        },
        currency: {
          type: "string",
          enum: ["VND", "USD"],
          default: "VND",
          description: "Đơn vị tiền tệ hiển thị",
        },
      },
    },
    code: `export default async function run(input) {
  const brand = String(input?.brand ?? "ALL").toUpperCase();
  const currency = String(input?.currency ?? "VND").toUpperCase();
  const rows = [
    { brand: "SJC", region: "TP.HCM", buyVnd: 88500000, sellVnd: 91000000, fxUsdVnd: 25420, unit: "lượng" },
    { brand: "DOJI", region: "Hà Nội", buyVnd: 88600000, sellVnd: 90900000, fxUsdVnd: 25420, unit: "lượng" },
    { brand: "PNJ", region: "Toàn quốc", buyVnd: 88400000, sellVnd: 90800000, fxUsdVnd: 25420, unit: "lượng" }
  ];
  const filtered = brand === "ALL" ? rows : rows.filter((r) => r.brand === brand);
  return filtered.map((r) => ({
    ...r,
    currency,
    buyPrice: currency === "USD" ? Number((r.buyVnd / r.fxUsdVnd).toFixed(2)) : r.buyVnd,
    sellPrice: currency === "USD" ? Number((r.sellVnd / r.fxUsdVnd).toFixed(2)) : r.sellVnd,
    capturedAt: new Date().toISOString()
  }));
}`,
  },
  {
    id: "vn-tech-news-actor",
    label: "VN Tech & Macro News Extractor",
    facetDisplayName: "VN Tech & Macro News Extractor",
    facetName: "vn-tech-news-actor",
    summary:
      "Extracts entities, topics, and sentiment from Vietnamese tech/fintech articles.",
    category: "vietnamese-data",
    tags: ["vietnam", "news", "nlp", "actor"],
    description:
      "Bóc tách thực thể, từ khóa và đánh giá sắc thái tin tức công nghệ/tài chính tiếng Việt thành Dataset.",
    pricingModel: "PAY_PER_RESULT",
    priceAtomic: "500",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          enum: ["ALL", "AI", "BLOCKCHAIN", "FINTECH"],
          default: "ALL",
          description: "Chủ đề tin tức Việt Nam",
        },
        limit: {
          type: "integer",
          default: 3,
          minimum: 1,
          maximum: 10,
          description: "Số lượng bản ghi tối đa",
        },
      },
    },
    code: `export default async function run(input) {
  const topic = String(input?.topic ?? "ALL").toUpperCase();
  const limit = Math.min(Math.max(Number(input?.limit ?? 3), 1), 10);
  const articles = [
    { topic: "BLOCKCHAIN", title: "Hệ sinh thái thanh toán x402 mở rộng ứng dụng AI Agent tại Việt Nam", source: "VnEconomy", sentiment: "POSITIVE", entities: ["x402", "Avalanche", "Việt Nam"] },
    { topic: "AI", title: "Startup Việt đẩy mạnh tự động hóa thu thập dữ liệu tiếng Việt chuẩn hóa", source: "VnExpress", sentiment: "POSITIVE", entities: ["AI Agent", "Dataset", "SaaS"] },
    { topic: "FINTECH", title: "Ngân hàng số thử nghiệm thanh toán vi mô tức thì bằng stablecoin", source: "CafeF", sentiment: "NEUTRAL", entities: ["Fintech", "Stablecoin", "API"] }
  ];
  const filtered = topic === "ALL" ? articles : articles.filter((a) => a.topic === topic);
  return filtered.slice(0, limit).map((item, idx) => ({
    rank: idx + 1,
    ...item,
    analyzedAt: new Date().toISOString()
  }));
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
    "Agent định danh on-chain trên Fuji, tự động tổng hợp dữ liệu vàng, tỷ giá và tin tức Việt Nam thành báo cáo phân tích có trích dẫn nguồn.",
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
    "Autonomous Agent anchored to an Avalanche Fuji on-chain identity token.",
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
