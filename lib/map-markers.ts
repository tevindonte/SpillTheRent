import L from "leaflet";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function createRentPillIcon(label: string, selected: boolean): L.DivIcon {
  const safe = escapeHtml(label);
  const selectedClass = selected ? " rent-pill-marker__label--selected" : "";
  return L.divIcon({
    className: "rent-pill-marker",
    html: `<span class="rent-pill-marker__label${selectedClass}">${safe}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}
