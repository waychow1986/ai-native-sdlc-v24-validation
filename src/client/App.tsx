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

interface FailureState {
  kind: "failure";
  generation: number;
}

type StatusViewState = LoadingState | SuccessState | FailureState;

type StatusAction =
  | {
      type: "begin";
      generation: number;
    }
  | {
      type: "succeed";
      generation: number;
      status: "ok";
    }
  | {
      type: "fail";
      generation: number;
    };

export const initialStatusState: LoadingState = {
  kind: "loading",
  generation: 1,
};

export function statusReducer(
  state: StatusViewState,
  action: StatusAction,
): StatusViewState {
  if (action.type === "begin") {
    return action.generation <= state.generation
      ? state
      : { kind: "loading", generation: action.generation };
  }
  if (action.generation !== state.generation) {
    return state;
  }
  if (action.type === "fail") {
    return { kind: "failure", generation: action.generation };
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
    const generation = state.generation;
    void requestStatus(controller.signal)
      .then((status) => {
        if (!controller.signal.aborted) {
          dispatch({ type: "succeed", generation, status });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          dispatch({ type: "fail", generation });
        }
      });
    return () => controller.abort();
  }, [requestStatus, state.generation]);

  const retry = (): void => {
    dispatch({ type: "begin", generation: state.generation + 1 });
  };

  return (
    <main>
      <h1>最小流程验证</h1>
      <section aria-label="当前状态">
        {state.kind === "failure" ? (
          <>
            <p role="alert">状态获取失败，请重试</p>
            <button type="button" onClick={retry}>
              重试
            </button>
          </>
        ) : (
          <p role="status" aria-live="polite">
            {state.kind === "loading" ? "正在获取状态" : state.status}
          </p>
        )}
      </section>
    </main>
  );
}
