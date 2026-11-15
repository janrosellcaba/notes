export function filedContext(active: string, projectId: string | null | undefined): string | undefined {
  if (projectId || active === "all") return undefined;
  return active;
}
