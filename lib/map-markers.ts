function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** HTML for MapLibre Marker rent pills (reuses globals.css classes). */
export function rentPillHtml(
  label: string,
  selected: boolean,
  signalHigh = false
): string {
  const safe = escapeHtml(label);
  const selectedClass = selected ? " rent-pill-marker__label--selected" : "";
  const signalDot = signalHigh
    ? `<span class="rent-pill-marker__signal" aria-hidden="true"></span>`
    : "";
  return `${signalDot}<span class="rent-pill-marker__label${selectedClass}">${safe}</span>`;
}
