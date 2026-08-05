import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  AgentTutorialPage,
  GLOBAL_INSTALL_COMMAND,
  PROJECT_INSTALL_COMMAND,
  VERIFY_PROMPT,
} from "../src/components/agent-tutorial-page";

afterEach(cleanup);

describe("Agent tutorial page", () => {
  it("renders the install, restart and first-query path", () => {
    render(<AgentTutorialPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "让 Agent 直接使用 GitHub Picks",
      }),
    ).toBeTruthy();
    expect(screen.getByText(PROJECT_INSTALL_COMMAND)).toBeTruthy();
    expect(screen.getByText(GLOBAL_INSTALL_COMMAND)).toBeTruthy();
    expect(screen.getByText(VERIFY_PROMPT)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "新开会话" })).toBeTruthy();
  });

  it("states the shipped capabilities and public-data boundary", () => {
    render(<AgentTutorialPage />);

    const capabilities = screen.getByRole("list", { name: "Agent 能力" });
    for (const label of [
      "最新日报",
      "周期持续价值榜",
      "五个技术方向",
      "仓库证据与历史观测",
    ]) {
      expect(within(capabilities).getByText(label)).toBeTruthy();
    }

    expect(screen.getByText(/不访问私有仓库/)).toBeTruthy();
    expect(screen.getByText(/不重新评分或按 Star 改序/)).toBeTruthy();
    expect(screen.queryByText(/^MCP$/)).toBeNull();
    expect(screen.queryByText(/^RSS$/)).toBeNull();
  });

  it("links to the public Skill, API status and runbook", () => {
    render(<AgentTutorialPage />);

    expect(
      screen.getByRole("link", { name: "Skill 源码" }).getAttribute("href"),
    ).toContain("/.agents/skills/github-picks");
    expect(
      screen.getByRole("link", { name: "API 状态" }).getAttribute("href"),
    ).toBe("https://aicode-nexus.github.io/github-picks/api/v1/meta.json");
    expect(
      screen.getByRole("link", { name: "接入运行手册" }).getAttribute("href"),
    ).toContain("/docs/runbooks/github-picks-agent-api.md");
  });
});
