import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = [
  "/",
  "/sources/",
  "/directions/ai-agent/",
  "/repositories/quickwit-oss/quickwit/",
] as const;

for (const route of routes) {
  test(`${route} has no serious or critical accessibility violations`, async ({
    page,
  }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).analyze();
    const blockingViolations = results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    );

    expect(
      blockingViolations,
      blockingViolations
        .map(
          (violation) =>
            `${violation.id}: ${violation.help}\n${violation.nodes
              .map((node) => `  ${node.target.join(" ")}`)
              .join("\n")}`,
        )
        .join("\n\n"),
    ).toEqual([]);
  });
}
