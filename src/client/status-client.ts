export async function requestStatus(signal: AbortSignal): Promise<void> {
  await fetch("/api/status", {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });
}
