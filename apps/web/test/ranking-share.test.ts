import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type DailyReport, DailyReportSchema } from "@github-picks/core/schema";
import { beforeAll, describe, expect, it } from "vitest";
import { buildDailyRankingItems } from "../src/lib/daily-ranking";
import { buildPeriodRanking } from "../src/lib/period-ranking";
import {
  appendRankingPageUrl,
  buildDailyRankingShareText,
  buildHistoryRankingShareText,
  buildPeriodRankingShareText,
} from "../src/lib/ranking-share";
import { buildRankingItems } from "../src/lib/view-model";

let reports: DailyReport[];

beforeAll(async () => {
  const reportPaths = [
    "../../artifacts/daily/2026-08-03-live/report.json",
    "../../artifacts/daily/2026-08-04/report.json",
  ];
  reports = await Promise.all(
    reportPaths.map(async (reportPath) =>
      DailyReportSchema.parse(
        JSON.parse(
          await readFile(resolve(process.cwd(), reportPath), "utf8"),
        ) as unknown,
      ),
    ),
  );
});

describe("ranking share text", () => {
  it("formats only supplied daily filter items with their GitHub URLs", () => {
    const report = reports[1];
    if (report === undefined) throw new Error("missing daily report");
    const filtered = buildDailyRankingItems(report).filter((item) =>
      item.tags.some((tag) => tag.id === "new"),
    );

    const text = buildDailyRankingShareText({
      date: report.date,
      filterLabel: "新项目",
      items: filtered,
    });

    expect(text).toContain(
      `${report.date}｜筛选：新项目｜共 ${filtered.length} 项`,
    );
    for (const item of filtered) {
      expect(text).toContain(
        `${String(item.rank).padStart(2, "0")} ${item.id}`,
      );
      expect(text).toContain(`项目地址：${item.githubUrl}`);
      expect(text).toContain(
        `推荐理由：${item.recommendationReason.replace(/\s+/g, " ").trim()}`,
      );
      expect(text).not.toContain(`项目地址：${item.href}`);
    }
  });

  it("formats honest period coverage and one performance line per item", () => {
    const ranking = buildPeriodRanking(reports, "7d");
    const leader = ranking.items[0];
    if (leader === undefined) throw new Error("missing period leader");

    const text = buildPeriodRankingShareText(ranking);

    expect(text).toContain(`${ranking.fromDate} 至 ${ranking.toDate}`);
    expect(text).toContain(`实际日报 ${ranking.reportCount} 份`);
    expect(text).toContain(`项目地址：${leader.githubUrl}`);
    expect(text).toContain(
      `周期表现：上榜 ${leader.appearanceCount}/${leader.reportCount} 日 · 平均发布分 ${leader.averageScore.toFixed(1)} · 最近名次 #${String(leader.latestDailyRank).padStart(2, "0")}`,
    );
  });

  it("formats a selected historical snapshot and normalizes embedded newlines", () => {
    const report = reports[0];
    if (report === undefined) throw new Error("missing history report");
    const items = buildRankingItems(report, report.rankings.overall);
    const first = items[0];
    if (first === undefined) throw new Error("missing historical leader");
    const changed = [
      { ...first, recommendationReason: "第一行\n  第二行" },
      ...items.slice(1),
    ];

    const text = buildHistoryRankingShareText({
      date: report.date,
      items: changed,
    });

    const [year, month, day] = report.date.split("-");
    expect(text).toContain("第一行 第二行");
    expect(text).toContain(
      `GitHub Picks｜${year}年${month}月${day}日综合价值榜`,
    );
  });

  it("keeps the current page URL as the final non-empty content", () => {
    const pageUrl =
      "https://example.test/github-picks/rankings/7d/?view=all#ranking";

    const text = appendRankingPageUrl("榜单正文\n", pageUrl);

    expect(text).toBe(`榜单正文\n\n完整榜单：\n${pageUrl}`);
    expect(text.trimEnd().endsWith(pageUrl)).toBe(true);
  });

  it("keeps an empty filtered ranking copyable", () => {
    expect(
      buildDailyRankingShareText({
        date: "2026-08-05",
        filterLabel: "新项目",
        items: [],
      }),
    ).toBe("GitHub Picks｜今日综合价值榜\n2026-08-05｜筛选：新项目｜共 0 项");
  });
});
