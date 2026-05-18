/** Client-side map load timing (dev / NEXT_PUBLIC_MAP_PERF=1). */

export const MAP_PERF_ENABLED =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_MAP_PERF === "1";

export type MapPerfStage =
  | "bounds_debounced"
  | "load_started"
  | "request_sent"
  | "response_received"
  | "markers_rendered";

type PerfEntry = {
  traceId: string;
  stage: MapPerfStage;
  t: number;
  detail?: Record<string, unknown>;
};

let traceSeq = 0;

export function newMapPerfTrace(): string {
  return `map-${Date.now()}-${++traceSeq}`;
}

export function logMapPerf(
  traceId: string,
  stage: MapPerfStage,
  detail?: Record<string, unknown>
): void {
  if (!MAP_PERF_ENABLED) return;
  const entry: PerfEntry = { traceId, stage, t: performance.now(), detail };
  console.info(`[map-perf] ${stage}`, entry);
}

export function mapPerfDelta(
  traceId: string,
  from: MapPerfStage,
  to: MapPerfStage,
  fromTime: number,
  toTime: number,
  extra?: Record<string, unknown>
): void {
  if (!MAP_PERF_ENABLED) return;
  console.info(`[map-perf] ${from} → ${to}`, {
    traceId,
    ms: Math.round(toTime - fromTime),
    ...extra,
  });
}
