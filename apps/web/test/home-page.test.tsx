import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type DailyReport, DailyReportSchema } from "@github-picks/core/schema";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { HomePage } from "../src/components/home-page";
import { SiteFooter } from "../src/components/site-footer";

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
    const firstRepositoryId = report.rankings.overall[0];
    if (firstRepositoryId === undefined) {
      throw new Error("missing ranked test repository");
    }
    render(<HomePage report={report} />);

    expect(screen.getByRole("heading", { name: /今日开源情报/ })).toBeTruthy();
    expect(screen.getByText("候选 → 补全 → 发布")).toBeTruthy();
    expect(
      screen.getAllByRole("link", { name: firstRepositoryId }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/HubLens/).length).toBeGreaterThan(0);
    expect(screen.getByText(/全部候选信号超过新鲜度阈值/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "五个技术方向" })).toBeTruthy();
  });

  it("keeps score, confidence and risk in separate elements", () => {
    const firstRepositoryId = report.rankings.overall[0];
    const firstRepository = report.repositories.find(
      (repository) => repository.snapshot.fullName === firstRepositoryId,
    );
    if (firstRepositoryId === undefined || firstRepository === undefined) {
      throw new Error("missing ranked test repository");
    }
    if (
      firstRepository.analysis.generation?.kind !== "ai" ||
      firstRepository.analysis.recommendationReason === undefined
    ) {
      throw new Error("missing AI recommendation fixture");
    }

    render(<HomePage report={report} />);
    const firstOverallRow = screen.getByTestId(
      `overall-row-${firstRepositoryId.replace("/", "-")}`,
    );

    expect(
      within(firstOverallRow).getByTestId("published-score").textContent,
    ).toContain(String(firstRepository.score.publishedScore));
    expect(
      within(firstOverallRow).getByTestId("confidence").textContent,
    ).toContain(`${Math.round(firstRepository.score.confidence * 100)}%`);
    expect(
      within(firstOverallRow).getByTestId("risk-penalty").textContent,
    ).toContain(String(firstRepository.score.riskPenalty));
    expect(within(firstOverallRow).getByText("AI 推荐理由")).toBeTruthy();
    expect(
      within(firstOverallRow).getByText(
        firstRepository.analysis.recommendationReason,
      ),
    ).toBeTruthy();
  });

  it("renders every repository once and filters without changing overall order", () => {
    render(<HomePage report={report} />);

    const renderedRepositories = Array.from(
      document.querySelectorAll<HTMLElement>("[data-repository-id]"),
    );
    const renderedIds = renderedRepositories.map(
      (repository) => repository.dataset.repositoryId,
    );

    expect(renderedIds).toEqual(report.rankings.overall);
    expect(new Set(renderedIds).size).toBe(report.rankings.overall.length);

    const newProjectsFilter = screen.getByRole("button", { name: "新项目" });
    fireEvent.click(newProjectsFilter);

    expect(newProjectsFilter.getAttribute("aria-pressed")).toBe("true");
    const visibleIds = renderedRepositories
      .filter((repository) => repository.closest("[hidden]") === null)
      .map((repository) => repository.dataset.repositoryId);
    const newProjectIds = new Set(report.rankings.newProjects);
    expect(visibleIds).toEqual(
      report.rankings.overall.filter((repositoryId) =>
        newProjectIds.has(repositoryId),
      ),
    );
  });

  it("consolidates the report, source and direction summaries", () => {
    const firstRepositoryId = report.rankings.overall[0];
    if (firstRepositoryId === undefined) {
      throw new Error("missing ranked test repository");
    }

    const { container } = render(<HomePage report={report} />);

    expect(screen.getByRole("region", { name: /今日开源情报/ })).toBeTruthy();
    expect(screen.getAllByText(/HubLens/)).toHaveLength(1);
    expect(
      screen.getByText(
        `${report.counts.discovered} → ${report.counts.enriched} → ${report.counts.published}`,
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId("source-warning")).toBeNull();
    expect(
      screen.getAllByRole("link", { name: firstRepositoryId }),
    ).toHaveLength(1);

    const directionIndex = container.querySelector(".direction-index");
    expect(directionIndex).toBeTruthy();
    for (const repositoryId of report.rankings.overall) {
      expect(directionIndex?.textContent).not.toContain(repositoryId);
    }
  });

  it("keeps only the external project link in the footer", () => {
    render(<SiteFooter />);

    expect(screen.queryByRole("navigation", { name: "页脚导航" })).toBeNull();
    expect(screen.getByRole("link", { name: "访问 GitHub" })).toBeTruthy();
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
