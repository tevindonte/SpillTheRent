export type DhcrRentLine = {
  amount: number;
  context: string;
};

export type DhcrBedroomRent = {
  bedrooms: number | null;
  label: string;
  amount: number;
  context: string;
};

export type DhcrParseResult = {
  rent_lines: DhcrRentLine[];
  bedroom_rents: DhcrBedroomRent[];
  suggested_legal_rent: number | null;
  max_rent_in_doc: number | null;
  overcharge_hint: boolean;
  excerpt: string;
};

const RENT_RE =
  /\$?\s*([1-9]\d{0,2}(?:,\d{3})*)\s*(?:\.\d{2})?(?=\s*(?:\/mo|per month|monthly|rent|legal|maximum|max))?/gi;

const BEDROOM_PATTERNS: { re: RegExp; bedrooms: number | null; label: string }[] = [
  { re: /\bstudio\b/i, bedrooms: 0, label: "Studio" },
  { re: /\b0\s*(?:br|bed|bedroom)\b/i, bedrooms: 0, label: "Studio" },
  { re: /\b1\s*(?:br|bed|bedroom)\b/i, bedrooms: 1, label: "1 BR" },
  { re: /\b2\s*(?:br|bed|bedroom)\b/i, bedrooms: 2, label: "2 BR" },
  { re: /\b3\s*(?:br|bed|bedroom)\b/i, bedrooms: 3, label: "3 BR" },
  { re: /\b4\s*(?:br|bed|bedroom)\b/i, bedrooms: 4, label: "4+ BR" },
];

function inferBedroom(context: string): { bedrooms: number | null; label: string } {
  for (const p of BEDROOM_PATTERNS) {
    if (p.re.test(context)) return { bedrooms: p.bedrooms, label: p.label };
  }
  return { bedrooms: null, label: "Unknown" };
}

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
    const start = Math.max(0, match.index - 60);
    rent_lines.push({
      amount,
      context: text.slice(start, start + 120).trim(),
    });
    if (rent_lines.length >= 24) break;
  }

  rent_lines.sort((a, b) => a.amount - b.amount);

  const bedroom_rents: DhcrBedroomRent[] = [];
  const bedroomSeen = new Set<string>();

  for (const line of rent_lines) {
    const { bedrooms, label } = inferBedroom(line.context);
    const key =
      bedrooms != null ? `b${bedrooms}-${line.amount}` : `u-${line.amount}`;
    if (bedroomSeen.has(key)) continue;
    bedroomSeen.add(key);
    bedroom_rents.push({
      bedrooms,
      label,
      amount: line.amount,
      context: line.context,
    });
  }

  bedroom_rents.sort((a, b) => {
    const ba = a.bedrooms ?? 99;
    const bb = b.bedrooms ?? 99;
    if (ba !== bb) return ba - bb;
    return a.amount - b.amount;
  });

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
    bedroom_rents,
    suggested_legal_rent,
    max_rent_in_doc,
    overcharge_hint,
    excerpt,
  };
}
