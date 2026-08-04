import {
  type AnalysisInput,
  buildAnalysisFactPackage,
  type ChineseAnalysis,
} from "@github-picks/core";
import { z } from "zod";

export const AI_ANALYSIS_VERSION = "v1.1.0";
export const AI_PROMPT_VERSION = "v1.0.0";

export interface RecommendationInput extends AnalysisInput {
  fallback: ChineseAnalysis;
}

export interface RecommendationGenerator {
  provider: string;
  model: string;
  promptVersion: string;
  analysisVersion: string;
  concurrency: number;
  generate(input: RecommendationInput): Promise<string>;
}

export interface OllamaRecommendationGeneratorOptions {
  baseUrl: string;
  model: string;
  concurrency?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const RecommendationOutputSchema = z
  .object({ recommendationReason: z.string().min(40).max(260) })
  .strict();

const OllamaResponseSchema = z.object({
  model: z.string().min(1),
  created_at: z.string().optional(),
  message: z.object({
    role: z.string().optional(),
    content: z.string().optional(),
    thinking: z.string().optional(),
  }),
  done: z.boolean().optional(),
});

const outputJsonSchema = {
  type: "object",
  properties: {
    recommendationReason: {
      type: "string",
      minLength: 40,
      maxLength: 260,
      description:
        "以仓库 fullName 开头的中文推荐理由，只包含核心价值、当期证据和适用对象。",
    },
  },
  required: ["recommendationReason"],
  additionalProperties: false,
} as const;

const forbiddenClaims =
  /全球第一|业界第一|绝对领先|最好(?:的)?|完美|突破性|性能突破|革命性|颠覆|零风险|无风险|没有.{0,6}风险|立即全面替换|保证安全|完全安全|无需核验|原样开头|事实包|热度值|GitHub\s*(?:搜索|Search)|许可证缺失|证据缺口|风险(?:扣分|边界|较高|较低)|扣分|需结合|需核验|需要核验|建议核验|验证其|工程适用性|实际性能|性能指标|适用性边界|适配性|工程验证不足|GPU 支持|GPU支持|教学效果|不适用于|截至\d|无(?:活跃|新提交|工程活动).{0,12}(?:持续维护|活跃开发|更新频繁)|通过.{0,8}Scorecard.{0,8}认证|Scorecard.{0,12}(?:认证|保证|证明)|许可证[^，。；]{0,16}适合|(?:MIT|Apache[^，。；]{0,12})[^，。；]{0,16}适合/i;

function buildRecommendationFactPackage(input: RecommendationInput) {
  const factPackage = buildAnalysisFactPackage(input);
  const { licenseSpdx, ...repository } = factPackage.repository;
  return {
    repository: {
      ...repository,
      ...(licenseSpdx ? { licenseSpdx } : {}),
    },
    activity: factPackage.activity,
    ...(factPackage.scorecard ? { scorecard: factPackage.scorecard } : {}),
    editorialContext: {
      audience: input.fallback.suitableFor.split("；")[0],
    },
    discoverySignals: factPackage.discoverySignals
      .filter(
        (signal) =>
          !signal.stale &&
          signal.sourceId !== "github-search" &&
          signal.sourceId !== "configured-seed",
      )
      .map((signal) => ({
        sourceId: signal.sourceId,
        sourceTier: signal.sourceTier,
        observedAt: signal.observedAt,
        rank: signal.rank,
        summaryZh: signal.summaryZh,
        metrics: {
          starVelocity: signal.metrics.starVelocity,
          discussionPoints: signal.metrics.discussionPoints,
          discussionComments: signal.metrics.discussionComments,
        },
        evidenceUrl: signal.evidenceUrl,
      })),
  };
}

function positiveInteger(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("GITHUB_PICKS_AI_BASE_URL must use http or https");
  }
  return url.toString().replace(/\/$/, "");
}

function unsupportedNumbers(
  reason: string,
  factPackage: ReturnType<typeof buildRecommendationFactPackage>,
): string[] {
  const normalizeThousands = (value: string) =>
    value.replace(/(?<=\d),(?=\d{3}(?:\D|$))/g, "");
  const allowedText = normalizeThousands(JSON.stringify(factPackage));
  const allowed = new Set(allowedText.match(/\d+(?:\.\d+)?/g) ?? []);
  const mentioned = normalizeThousands(reason).match(/\d+(?:\.\d+)?/g) ?? [];
  return mentioned.filter((value) => !allowed.has(value));
}

function validateReason(
  reason: string,
  input: RecommendationInput,
  factPackage: ReturnType<typeof buildRecommendationFactPackage>,
): string {
  let normalized = reason.trim();
  if (!normalized.startsWith(`${input.snapshot.fullName}：`)) {
    throw new Error(
      `AI recommendation must start with ${input.snapshot.fullName}：`,
    );
  }
  const forbiddenMatch = normalized.match(forbiddenClaims);
  if (forbiddenMatch) {
    throw new Error(
      `AI recommendation contains 禁止表述: ${forbiddenMatch[0]}`,
    );
  }
  const compactReason = normalized.replace(/\s+/g, "").toLowerCase();
  const compactLanguage = input.snapshot.language
    ?.replace(/\s+/g, "")
    .toLowerCase();
  if (
    compactLanguage &&
    (compactReason.includes(`仅限${compactLanguage}环境`) ||
      compactReason.includes(`仅限${compactLanguage}使用`) ||
      compactReason.includes("非通用编程语言"))
  ) {
    throw new Error(
      "AI recommendation treats repository language as runtime limit",
    );
  }
  if (
    /星标?.{0,12}(?:验证|证明).{0,12}(?:活跃|适用|能力|质量|成熟)/.test(
      normalized,
    )
  ) {
    throw new Error("AI recommendation treats stars as capability evidence");
  }
  if (
    /(?:排名|讨论热度).{0,12}(?:显示|表明|证明|验证).{0,12}(?:技术价值|工程价值|质量|能力|成熟|活跃)/.test(
      normalized,
    )
  ) {
    throw new Error(
      "AI recommendation treats discovery attention as capability evidence",
    );
  }
  const description = input.snapshot.description ?? "";
  const descriptionNumbers = new Set(description.match(/\d+(?:\.\d+)?/g) ?? []);
  const repeatsDescriptionNumber = (
    normalized.match(/\d+(?:\.\d+)?/g) ?? []
  ).some((value) => descriptionNumbers.has(value));
  if (
    repeatsDescriptionNumber &&
    !/项目自述|仓库自述|项目定位/.test(normalized)
  ) {
    normalized = normalized.replace(
      `${input.snapshot.fullName}：`,
      `${input.snapshot.fullName}：项目自述，`,
    );
  }
  const unsupported = unsupportedNumbers(normalized, factPackage);
  if (unsupported.length > 0) {
    throw new Error(
      `AI recommendation has unsupported numeric claim: ${unsupported.join(",")}`,
    );
  }
  return normalized;
}

function promptFor(
  input: RecommendationInput,
  factPackage: ReturnType<typeof buildRecommendationFactPackage>,
): string {
  return [
    "请基于下方唯一事实包生成一条中文推荐理由。",
    `开头格式必须严格为 \`${input.snapshot.fullName}：\`，冒号后直接写判断；正文不得出现“原样开头”或“事实包”。`,
    "只写两句、共 60 至 150 个中文字符，不要套用固定小标题。第一句概括核心价值；第二句只用近期活动、发现信号、许可证或 Scorecard 说明为什么本期值得看，并结合 editorialContext.audience 说明适合谁。",
    "只允许使用事实包中的事实与数字；证据不足时省略该主张，不得补充模型记忆。",
    "description 和 summaryZh 是项目或信源自述，只能写成项目定位，不能强化为已验证性能；编程语言不等于项目只能用于该语言环境。",
    "涉及项目描述中的性能、倍数、GPU 或 token 承诺时，必须明确写“项目自述”；Star 与讨论数据只能说明关注度，不能证明工程能力、质量、活跃度或适用性。",
    "GitTrend 或 Hacker News 的名次只能说明社区关注，不能证明维护活跃或技术价值；引用项目描述中的任何数字时必须明确写“项目自述”。",
    "优先使用近期工程活动、新鲜 GitTrend/Hacker News 关注信号、许可证或 Scorecard。",
    "OpenSSF Scorecard 只是安全工程信号，不是认证；许可证只说明法律边界，不能证明项目适合生产、某类团队或企业级部署。",
    "没有近期工程活动时，不得同时声称项目持续维护、活跃开发或更新频繁。",
    "不要复述内部评分或原始热度值；可读数字最多使用两个，并且只在帮助用户判断时使用。",
    "推荐理由不要写风险、限制、核验建议或下一步，网站会用独立规则区块展示这些内容。不要翻译 README，不要写营销口号，不要把高分写成生产可用或安全通过。",
    "严格输出符合给定 JSON Schema 的 JSON。",
    `事实包：${JSON.stringify(factPackage)}`,
  ].join("\n");
}

export class OllamaRecommendationGenerator implements RecommendationGenerator {
  readonly provider = "ollama";
  readonly promptVersion = AI_PROMPT_VERSION;
  readonly analysisVersion = AI_ANALYSIS_VERSION;
  readonly model: string;
  readonly concurrency: number;
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OllamaRecommendationGeneratorOptions) {
    this.model = options.model.trim();
    if (this.model === "") throw new Error("Ollama model must not be empty");
    this.endpoint = `${parseBaseUrl(options.baseUrl)}/api/chat`;
    this.concurrency = options.concurrency ?? 1;
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async generate(input: RecommendationInput): Promise<string> {
    const factPackage = buildRecommendationFactPackage(input);
    let previousFailure: string | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const correction = previousFailure
          ? `\n上一次输出未通过发布校验：${previousFailure}。请完全重写。除仓库名中原有字符外，不得使用任何阿拉伯数字；只写核心价值、本期工程活动或社区关注信号和适用对象，不得写风险、限制、核验、性能承诺或兼容性判断。`
          : "";
        const response = await this.fetchImpl(this.endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: AbortSignal.timeout(this.timeoutMs),
          body: JSON.stringify({
            model: this.model,
            messages: [
              {
                role: "system",
                content:
                  "你是严谨的中文开源项目技术编辑。你的结论必须由输入事实支撑，并明确证据边界。",
              },
              {
                role: "user",
                content: `${promptFor(input, factPackage)}${correction}`,
              },
            ],
            stream: false,
            think: false,
            format: outputJsonSchema,
            options: { temperature: 0.1, num_ctx: 4096 },
          }),
        });
        if (!response.ok) {
          const message = (await response.text()).slice(0, 500);
          throw new Error(`Ollama ${response.status}: ${message}`);
        }
        const body = OllamaResponseSchema.parse(await response.json());
        const raw =
          body.message.content?.trim() || body.message.thinking?.trim();
        if (!raw) throw new Error("Ollama response has no structured content");
        const output = RecommendationOutputSchema.parse(JSON.parse(raw));
        return validateReason(output.recommendationReason, input, factPackage);
      } catch (error) {
        previousFailure =
          error instanceof Error ? error.message : "unknown model failure";
      }
    }
    throw new Error(previousFailure ?? "AI recommendation generation failed");
  }
}

export function createRecommendationGeneratorFromEnvironment(
  environment: NodeJS.ProcessEnv,
  fetchImpl?: typeof fetch,
): RecommendationGenerator | null {
  const model = environment.GITHUB_PICKS_AI_MODEL?.trim();
  if (!model) return null;
  const provider = environment.GITHUB_PICKS_AI_PROVIDER?.trim() || "ollama";
  if (provider !== "ollama") {
    throw new Error(`unsupported AI analysis provider: ${provider}`);
  }
  return new OllamaRecommendationGenerator({
    model,
    baseUrl:
      environment.GITHUB_PICKS_AI_BASE_URL?.trim() || "http://127.0.0.1:11434",
    concurrency: positiveInteger(
      environment.GITHUB_PICKS_AI_CONCURRENCY,
      1,
      "GITHUB_PICKS_AI_CONCURRENCY",
    ),
    timeoutMs: positiveInteger(
      environment.GITHUB_PICKS_AI_TIMEOUT_MS,
      120_000,
      "GITHUB_PICKS_AI_TIMEOUT_MS",
    ),
    ...(fetchImpl ? { fetchImpl } : {}),
  });
}

export function aiAnalysisIsRequired(environment: NodeJS.ProcessEnv): boolean {
  const value = environment.GITHUB_PICKS_AI_REQUIRED?.trim().toLowerCase();
  if (!value) return false;
  if (["1", "true", "yes"].includes(value)) return true;
  if (["0", "false", "no"].includes(value)) return false;
  throw new Error("GITHUB_PICKS_AI_REQUIRED must be true or false");
}
