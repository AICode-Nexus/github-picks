import type { Metadata } from "next";
import { HistoryIndexPage } from "../../components/history-index-page";
import { buildReportArchive } from "../../lib/period-ranking";
import { getLiveReportHistory } from "../../lib/report-store";

export const metadata: Metadata = {
  title: "历史日报查询",
  description: "按日期查询 GitHub Picks 已存档的中文开源项目实时日报。",
};

export default async function Page() {
  const reports = await getLiveReportHistory();
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
  return (
    <HistoryIndexPage
      entries={buildReportArchive(reports)}
      basePath={basePath}
    />
  );
}
