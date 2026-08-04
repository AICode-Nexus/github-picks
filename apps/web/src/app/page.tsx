import { HomePage } from "../components/home-page";
import { getLatestLiveReport } from "../lib/report-store";

export default async function Page() {
  const report = await getLatestLiveReport();
  return <HomePage report={report} />;
}
