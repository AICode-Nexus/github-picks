import { resolve } from "node:path";
import { buildPublicApiDocuments, writePublicApi } from "../src/lib/public-api";
import { getLiveReportHistory } from "../src/lib/report-store";

const reports = await getLiveReportHistory();
const documents = buildPublicApiDocuments(reports, {
  publicBaseUrl:
    process.env.GITHUB_PICKS_PUBLIC_BASE_URL ??
    "https://aicode-nexus.github.io/github-picks",
});

await writePublicApi(resolve(process.cwd(), "out"), documents);

console.log(`Generated ${documents.length} public API documents.`);
