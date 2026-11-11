import { useEffect, useReducer, type ReactElement } from "react";

import { requestStatus as defaultRequestStatus } from "./status-client.js";

interface LoadingState {
  kind: "loading";
  generation: number;
}

interface BeginAction {
  type: "begin";
  generation: number;
}

export const initialStatusState: LoadingState = {
  kind: "loading",
  generation: 1,
};

export function statusReducer(
  state: LoadingState,
  action: BeginAction,
): LoadingState {
  if (action.generation <= state.generation) {
    return state;
  }
  return { kind: "loading", generation: action.generation };
}

interface AppProps {
  requestStatus?: (signal: AbortSignal) => Promise<void>;
}

export function App({
  requestStatus = defaultRequestStatus,
}: AppProps): ReactElement {
  const [state, dispatch] = useReducer(statusReducer, initialStatusState);

  useEffect(() => {
    const controller = new AbortController();
    dispatch({ type: "begin", generation: 1 });
    void requestStatus(controller.signal).catch(() => undefined);
    return () => controller.abort();
  }, [requestStatus]);

  return (
    <main>
      <h1>最小流程验证</h1>
      <section aria-label="当前状态">
        <p role="status" aria-live="polite">
          {state.kind === "loading" ? "正在获取状态" : ""}
        </p>
      </section>
    </main>
  );
}
