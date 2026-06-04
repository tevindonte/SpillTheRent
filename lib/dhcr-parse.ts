export type DhcrRentLine = {
  amount: number;
  context: string;
};

export type DhcrParseResult = {
  rent_lines: DhcrRentLine[];
  suggested_legal_rent: number | null;
  max_rent_in_doc: number | null;
  overcharge_hint: boolean;
  excerpt: string;
};

const RENT_RE =
  /\$?\s*([1-9]\d{0,2}(?:,\d{3})*)\s*(?:\.\d{2})?(?=\s*(?:\/mo|per month|monthly|rent|legal|maximum|max))?/gi;

export async function parseDhcrPdf(buffer: Buffer): Promise<DhcrParseResult> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  let text = "";
  try {
    const result = await parser.getText();
    text = (result.text ?? "").replace(/\s+/g, " ").trim();
  } finally {
    await parser.destroy();
  }
  const excerpt = text.slice(0, 800);

  const rent_lines: DhcrRentLine[] = [];
  const seen = new Set<number>();

  let match: RegExpExecArray | null;
  const re = new RegExp(RENT_RE.source, RENT_RE.flags);
  while ((match = re.exec(text)) !== null) {
    const raw = match[1].replace(/,/g, "");
    const amount = parseInt(raw, 10);
    if (!Number.isFinite(amount) || amount < 400 || amount > 50000) continue;
    if (seen.has(amount)) continue;
    seen.add(amount);
    const start = Math.max(0, match.index - 40);
    rent_lines.push({
      amount,
      context: text.slice(start, start + 100).trim(),
    });
    if (rent_lines.length >= 24) break;
  }

  rent_lines.sort((a, b) => a.amount - b.amount);

  const amounts = rent_lines.map((r) => r.amount);
  const suggested_legal_rent =
    amounts.length > 0 ? amounts[Math.floor(amounts.length / 2)] : null;
  const max_rent_in_doc = amounts.length ? amounts[amounts.length - 1] : null;

  const lower = text.toLowerCase();
  const hasLegal =
    lower.includes("legal regulated rent") ||
    lower.includes("legal rent") ||
    lower.includes("maximum rent");
  const overcharge_hint =
    hasLegal &&
    amounts.length >= 2 &&
    amounts[amounts.length - 1] > (suggested_legal_rent ?? 0) * 1.05;

  return {
    rent_lines,
    suggested_legal_rent,
    max_rent_in_doc,
    overcharge_hint,
    excerpt,
  };
}
