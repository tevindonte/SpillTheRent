import { toPng } from "html-to-image";
import type { BuildingDetail } from "@/lib/building-detail";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export async function captureRapSheetPng(node: HTMLElement): Promise<Blob> {
  const dataUrl = await toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: "#0a0a0a",
  });
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function shareRapSheetImage(
  node: HTMLElement,
  detail: BuildingDetail
): Promise<"shared" | "downloaded"> {
  const blob = await captureRapSheetPng(node);
  const filename = `${slugify(detail.name) || "building"}-rapsheet.png`;
  const file = new File([blob], filename, { type: "image/png" });

  if (
    typeof navigator !== "undefined" &&
    navigator.canShare?.({ files: [file] })
  ) {
    await navigator.share({
      files: [file],
      title: `${detail.name} · spillthe.rent Rap Sheet`,
      text: "Building intel from spillthe.rent",
    });
    return "shared";
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}
