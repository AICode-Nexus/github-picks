import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type DailyReport, DailyReportSchema } from "@github-picks/core/schema";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { HomePage } from "../src/components/home-page";

let report: DailyReport;

beforeAll(async () => {
  const reportPath = resolve(
    process.cwd(),
    "../../artifacts/daily/2026-08-04/report.json",
  );
  report = DailyReportSchema.parse(
    JSON.parse(await readFile(reportPath, "utf8")) as unknown,
  );
});

afterEach(cleanup);

describe("GitHub Picks homepage", () => {
  it("renders the live intelligence cover, rankings and direction index", () => {
    render(<HomePage report={report} />);

    expect(screen.getByRole("heading", { name: /今日开源情报/ })).toBeTruthy();
    expect(screen.getByText("60 个候选")).toBeTruthy();
    expect(
      screen.getAllByRole("link", { name: /quickwit-oss\/quickwit/ }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/HubLens/).length).toBeGreaterThan(0);
    expect(screen.getByText(/全部候选信号超过新鲜度阈值/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "五个技术方向" })).toBeTruthy();
  });

  it("keeps score, confidence and risk in separate elements", () => {
    render(<HomePage report={report} />);
    const firstOverallRow = screen.getByTestId(
      "overall-row-quickwit-oss-quickwit",
    );

    expect(
      within(firstOverallRow).getByTestId("published-score").textContent,
    ).toContain("66.9");
    expect(
      within(firstOverallRow).getByTestId("confidence").textContent,
    ).toContain("90%");
    expect(
      within(firstOverallRow).getByTestId("risk-penalty").textContent,
    ).toContain("0");
  });

  it("does not show a warning strip when every source is healthy", () => {
    const healthyReport = structuredClone(report);
    healthyReport.sourceHealth = healthyReport.sourceHealth.map((source) => ({
      ...source,
      status: "healthy",
      message: null,
    }));

    render(<HomePage report={healthyReport} />);

    expect(screen.queryByTestId("source-warning")).toBeNull();
  });
});
