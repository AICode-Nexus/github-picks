import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type DailyReport, DailyReportSchema } from "@github-picks/core/schema";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { DirectionPage } from "../src/components/direction-page";
import { EmptyRanking } from "../src/components/empty-ranking";
import { RepositoryDetail } from "../src/components/repository-detail";
import { SourceHealthTable } from "../src/components/source-health-table";

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

describe("direction intelligence", () => {
  it("renders a complete direction ranking with decision metrics", () => {
    render(
      <DirectionPage report={report} directionId="security-supply-chain" />,
    );

    expect(
      screen.getByRole("heading", { name: "安全与软件供应链" }),
    ).toBeTruthy();
    expect(screen.getByText("3 个项目入榜")).toBeTruthy();
    expect(
      screen.getAllByRole("link", { name: /aquasecurity\/trivy/ }).length,
    ).toBeGreaterThan(0);
  });

  it("uses an honest explanation when a direction is empty", () => {
    const emptyReport = structuredClone(report);
    emptyReport.rankings.byDirection["security-supply-chain"] = [];

    render(
      <DirectionPage
        report={emptyReport}
        directionId="security-supply-chain"
      />,
    );

    expect(screen.getByText(/未达到当前证据门槛/)).toBeTruthy();
  });
});

describe("repository intelligence", () => {
  it("describes missing Scorecard as an evidence gap", () => {
    render(<RepositoryDetail report={report} repositoryId="lyogavin/airllm" />);

    expect(screen.getAllByText("安全工程证据缺口").length).toBeGreaterThan(0);
    expect(screen.queryByText(/发现安全漏洞/)).toBeNull();
  });

  it("warns before production adoption when the license is missing", () => {
    render(
      <RepositoryDetail
        report={report}
        repositoryId="argonne-lcf/atpesc_machinelearning"
      />,
    );

    expect(screen.getByText("未识别 · 生产采用前需核验")).toBeTruthy();
    expect(
      screen.getAllByText(/GitHub 未返回明确许可证/).length,
    ).toBeGreaterThan(0);
  });

  it("deduplicates public evidence links and never exposes raw object hashes", () => {
    const { container } = render(
      <RepositoryDetail report={report} repositoryId="quickwit-oss/quickwit" />,
    );
    const evidenceRegion = screen.getByRole("region", { name: "公开证据" });
    const urls = [...evidenceRegion.querySelectorAll("a")].map((link) =>
      link.getAttribute("href"),
    );

    expect(new Set(urls).size).toBe(urls.length);
    expect(container.textContent).not.toContain("sha256:");
  });
});

describe("source health semantics", () => {
  it("keeps source diagnostics and neutral missing-evidence wording", () => {
    render(<SourceHealthTable sources={report.sourceHealth} />);

    expect(screen.getByText("HubLens")).toBeTruthy();
    expect(screen.getByText("全部候选信号超过新鲜度阈值")).toBeTruthy();
    expect(screen.getByText(/覆盖不足不等于安全通过或失败/)).toBeTruthy();
  });

  it("provides a reusable empty-ranking explanation", () => {
    render(<EmptyRanking />);

    expect(screen.getByText(/未达到当前证据门槛/)).toBeTruthy();
  });
});
