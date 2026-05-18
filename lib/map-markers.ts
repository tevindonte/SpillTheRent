import L from "leaflet";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function createRentPillIcon(
  label: string,
  selected: boolean,
  signalHigh = false
): L.DivIcon {
  const safe = escapeHtml(label);
  const selectedClass = selected ? " rent-pill-marker__label--selected" : "";
  const signalDot = signalHigh
    ? `<span class="rent-pill-marker__signal" aria-hidden="true"></span>`
    : "";
  return L.divIcon({
    className: "rent-pill-marker",
    html: `${signalDot}<span class="rent-pill-marker__label${selectedClass}">${safe}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}
