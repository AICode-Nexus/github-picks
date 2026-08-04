const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function normalizeRepositoryId(input: string): string | null {
  let value = input.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.hostname.toLowerCase() !== "github.com") return null;
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length !== 2) return null;
    value = `${segments[0]}/${segments[1]}`;
  } catch {
    value = value.replace(/^\/+|\/+$/g, "");
  }

  value = value.replace(/\.git$/i, "").replace(/\/$/, "");
  if (!repositoryPattern.test(value)) return null;
  return value.toLowerCase();
}
