import type { Metadata } from "next";
import Home from "@/app/page";
import { imLine, parseShareCard, shareSearch, SIT_DARE } from "@/lib/share";

export const dynamic = "force-dynamic";

/**
 * A real 200, not a redirect. Crawlers read this page's og:image (the
 * /s/opengraph-image route with this query). Humans get the live board —
 * the same app as /, reveal gate unchanged for them.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const card = parseShareCard(await searchParams);
  if (!card) {
    return {
      title: "gridgame",
      description: SIT_DARE,
    };
  }

  const line = imLine(card);
  const image = `/s/opengraph-image?${shareSearch(card)}`;

  return {
    title: line,
    description: SIT_DARE,
    openGraph: {
      title: line,
      description: SIT_DARE,
      images: [{ url: image, width: 1200, height: 630, alt: line }],
    },
    twitter: {
      card: "summary_large_image",
      title: line,
      description: SIT_DARE,
      images: [image],
    },
  };
}

export default Home;
