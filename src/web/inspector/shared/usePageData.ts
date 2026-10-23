import { useEffect, useState } from "react";
import type { PageData } from "../../../extract/pageData";
import type { PageRow } from "./types";

/** Page data files are large and never change once uploaded, so fetch each once per session. */
const cache = new Map<string, Promise<PageData>>();
const fetchPage = (url: string) => {
  if (!cache.has(url)) cache.set(url, fetch(url).then((r) => r.json()));
  return cache.get(url)!;
};

/** The words and spans of the given pages (by global page number), as they load. */
export function usePageData(pages: PageRow[], numbers: number[]): Map<number, PageData> {
  const [data, setData] = useState(new Map<number, PageData>());
  const key = [...new Set(numbers)].sort((a, b) => a - b).join(",");

  useEffect(() => {
    let live = true;
    const rows = pages.filter((p) => key.split(",").includes(String(p.page)));
    Promise.all(rows.map(async (p) => [p.page, await fetchPage(p.jsonUrl)] as const)).then((loaded) => {
      if (live) setData(new Map(loaded));
    });
    return () => {
      live = false;
    };
  }, [pages, key]);

  return data;
}
