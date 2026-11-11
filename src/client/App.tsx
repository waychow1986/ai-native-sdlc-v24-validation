import { useEffect, useReducer, type ReactElement } from "react";

import { requestStatus as defaultRequestStatus } from "./status-client.js";

interface LoadingState {
  kind: "loading";
  generation: number;
}

interface SuccessState {
  kind: "success";
  generation: number;
  status: "ok";
}

type StatusViewState = LoadingState | SuccessState;

type StatusAction =
  | {
      type: "begin";
      generation: number;
    }
  | {
      type: "succeed";
      generation: number;
      status: "ok";
    };

export const initialStatusState: LoadingState = {
  kind: "loading",
  generation: 1,
};

export function statusReducer(
  state: StatusViewState,
  action: StatusAction,
): StatusViewState {
  if (action.generation < state.generation) {
    return state;
  }
  if (action.type === "begin") {
    return action.generation === state.generation
      ? state
      : { kind: "loading", generation: action.generation };
  }
  return {
    kind: "success",
    generation: action.generation,
    status: action.status,
  };
}

interface AppProps {
  requestStatus?: (signal: AbortSignal) => Promise<"ok">;
}

export function App({
  requestStatus = defaultRequestStatus,
}: AppProps): ReactElement {
  const [state, dispatch] = useReducer(statusReducer, initialStatusState);

  useEffect(() => {
    const controller = new AbortController();
    dispatch({ type: "begin", generation: 1 });
    void requestStatus(controller.signal)
      .then((status) => {
        if (!controller.signal.aborted) {
          dispatch({ type: "succeed", generation: 1, status });
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [requestStatus]);

  return (
    <main>
      <h1>最小流程验证</h1>
      <section aria-label="当前状态">
        <p role="status" aria-live="polite">
          {state.kind === "loading" ? "正在获取状态" : state.status}
        </p>
      </section>
    </main>
  );
}
