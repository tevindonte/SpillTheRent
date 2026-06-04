const VISITOR_KEY = "spill_coverage_visitor_notice_v1";

export function isVisitorCoverageNoticeDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(VISITOR_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissVisitorCoverageNotice(): void {
  try {
    sessionStorage.setItem(VISITOR_KEY, "1");
  } catch {
    /* ignore */
  }
}
