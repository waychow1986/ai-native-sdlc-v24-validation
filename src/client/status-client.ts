type StatusValue = "ok";

function isStatusResponse(value: unknown): value is { status: StatusValue } {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const keys = Object.keys(value);
  return (
    keys.length === 1 &&
    keys[0] === "status" &&
    (value as Record<string, unknown>).status === "ok"
  );
}

export async function requestStatus(
  signal: AbortSignal,
  fetchImplementation: typeof fetch = fetch,
): Promise<StatusValue> {
  const timeoutController = new AbortController();
  const requestController = new AbortController();
  const abortRequest = (): void => requestController.abort();
  signal.addEventListener("abort", abortRequest, { once: true });
  timeoutController.signal.addEventListener("abort", abortRequest, {
    once: true,
  });
  const timeout = setTimeout(() => timeoutController.abort(), 2_500);

  try {
    const response = await fetchImplementation("/api/status", {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: requestController.signal,
    });
    const mediaType = response.headers.get("content-type")?.split(";", 1)[0];
    if (
      response.status !== 200 ||
      mediaType?.trim().toLowerCase() !== "application/json"
    ) {
      throw new Error("status_request_failed");
    }

    const body: unknown = await response.json();
    if (!isStatusResponse(body)) {
      throw new Error("status_request_failed");
    }
    return body.status;
  } catch {
    throw new Error("status_request_failed");
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abortRequest);
  }
}
