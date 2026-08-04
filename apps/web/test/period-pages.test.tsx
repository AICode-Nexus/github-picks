import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type DailyReport, DailyReportSchema } from "@github-picks/core/schema";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { HistoryIndexPage } from "../src/components/history-index-page";
import { HistoryReportPage } from "../src/components/history-report-page";
import { PeriodRankingPage } from "../src/components/period-ranking-page";
import {
  buildPeriodRanking,
  buildReportArchive,
} from "../src/lib/period-ranking";

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

afterEach(cleanup);

describe("period ranking experience", () => {
  it("renders honest coverage and the sustained ranking without local navigation", () => {
    const ranking = buildPeriodRanking(reports, "7d");
    const leader = ranking.items[0];
    if (leader === undefined) throw new Error("missing period leader");

    render(<PeriodRankingPage ranking={ranking} />);

    expect(
      screen.queryByRole("navigation", { name: "榜单时间范围" }),
    ).toBeNull();
    expect(
      screen.getByRole("heading", { name: "近 7 天持续价值榜" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("link", { name: leader.id })).toHaveLength(1);
    expect(screen.getAllByText(/当前历史库尚缺 5 天/)).toHaveLength(1);
    const leaderRow = screen.getByTestId(
      `period-row-${leader.id.replace("/", "-")}`,
    );
    expect(
      within(leaderRow).getByRole("link", { name: leader.id }),
    ).toBeTruthy();
    const coverage = screen.getByRole("region", { name: "周期数据覆盖" });
    expect(
      within(coverage).getByText(`${ranking.reportCount} 份`),
    ).toBeTruthy();
    expect(
      within(coverage).getByText(`${Math.round(ranking.coverageRate * 100)}%`),
    ).toBeTruthy();
    expect(
      within(coverage).getByText(`${ranking.uniqueRepositoryCount} 个`),
    ).toBeTruthy();
    expect(
      within(coverage).getByText(`${ranking.reportCount} / ${ranking.days} 天`),
    ).toBeTruthy();
    const coverageProgress = within(coverage).getByRole("progressbar", {
      name: `${ranking.label}历史数据覆盖率`,
    });
    expect(coverageProgress.getAttribute("max")).toBe(String(ranking.days));
    expect(coverageProgress.getAttribute("value")).toBe(
      String(ranking.reportCount),
    );
    expect(within(coverage).getByText(/当前历史库尚缺 5 天/)).toBeTruthy();
    expect(
      within(coverage).getByRole("link", { name: "查看历史库" }),
    ).toBeTruthy();
    expect(screen.getAllByTestId(/^period-row-/).length).toBeGreaterThan(0);
  });
});

describe("history query experience", () => {
  it("lists stored reports newest first and exposes an exact date query", () => {
    const archive = buildReportArchive(reports);

    render(<HistoryIndexPage entries={archive} />);

    expect(screen.getByRole("heading", { name: "历史日报查询" })).toBeTruthy();
    expect(screen.getByLabelText("选择已存档日期")).toBeTruthy();
    const archiveLinks = screen.getAllByRole("link", {
      name: /查看 .* 日报/,
    });
    expect(archiveLinks[0]?.getAttribute("href")).toBe("/history/2026-08-04");
  });

  it("renders a selected snapshot with previous and next history navigation", () => {
    const archive = buildReportArchive(reports);
    const report = reports[0];
    if (report === undefined) throw new Error("missing history test report");

    render(
      <HistoryReportPage
        report={report}
        archive={archive}
        previousDate={null}
        nextDate="2026-08-04"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "2026年08月03日 开源情报" }),
    ).toBeTruthy();
    expect(screen.getByText(/所选日期的不可变公开快照/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /下一期/ }).getAttribute("href"),
    ).toBe("/history/2026-08-04");
    expect(
      screen.getByRole("heading", { name: "当日综合价值榜" }),
    ).toBeTruthy();
  });
});
