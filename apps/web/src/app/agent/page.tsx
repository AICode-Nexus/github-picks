import type { Metadata } from "next";
import { AgentTutorialPage } from "../../components/agent-tutorial-page";

export const metadata: Metadata = {
  title: "Agent 接入",
  description:
    "安装 GitHub Picks Agent Skill，查询最新开源日报、周期榜、技术方向和仓库证据。",
};

export default function Page() {
  return <AgentTutorialPage />;
}
