import { NextRequest, NextResponse } from "next/server";

const STREET_VIEW_BASE = "https://maps.googleapis.com/maps/api/streetview";
const IMAGE_SIZE = "800x500";

export async function GET(request: NextRequest) {
  const latParam = request.nextUrl.searchParams.get("lat");
  const lngParam = request.nextUrl.searchParams.get("lng");

  const lat = latParam != null ? Number(latParam) : NaN;
  const lng = lngParam != null ? Number(lngParam) : NaN;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "Valid lat and lng query parameters are required" },
      { status: 400 }
    );
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "Coordinates out of range" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Street View is not configured" },
      { status: 503 }
    );
  }

  const googleUrl = new URL(STREET_VIEW_BASE);
  googleUrl.searchParams.set("size", IMAGE_SIZE);
  googleUrl.searchParams.set("location", `${lat},${lng}`);
  googleUrl.searchParams.set("key", apiKey);
  googleUrl.searchParams.set("return_error_codes", "true");

  let googleResponse: Response;
  try {
    googleResponse = await fetch(googleUrl.toString(), {
      cache: "force-cache",
      next: { revalidate: 60 * 60 * 24 * 7 },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to reach Google Street View" },
      { status: 502 }
    );
  }

  const contentType = googleResponse.headers.get("content-type") ?? "";
  if (
    !googleResponse.ok ||
    !contentType.startsWith("image/")
  ) {
    let message = "No Street View imagery for this location";
    try {
      const payload = await googleResponse.json();
      if (payload.status) message = payload.status;
    } catch {
      // ignore
    }
    return NextResponse.json({ error: message }, { status: 404 });
  }

  const imageBuffer = await googleResponse.arrayBuffer();

  return new NextResponse(imageBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
    },
  });
}
