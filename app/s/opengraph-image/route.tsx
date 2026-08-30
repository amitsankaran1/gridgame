import { parseShareCard } from "@/lib/share";
import { shareImageResponse } from "@/lib/share-og";

// Node, not Edge: ImageResponse is fine on either, but this matches the
// homepage card so a future pg read would not surprise us.
export const runtime = "nodejs";
// Query params are the whole card. A cached image would pin the first
// unfurl's plot onto every later share of /s.
export const dynamic = "force-dynamic";

/**
 * The public image for /s. File-convention opengraph-image.tsx cannot see
 * searchParams, so this is a real GET — crawlers request
 * /s/opengraph-image?xl=…&x=… and get this card, not the homepage's.
 */
export async function GET(request: Request) {
  const card = parseShareCard(new URL(request.url).searchParams);
  return shareImageResponse(card);
}
