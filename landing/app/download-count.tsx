"use client";

import { useEffect, useState } from "react";

export function DownloadCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("https://api.github.com/repos/mbaril010/tasmania/releases")
      .then((res) => res.json())
      .then((releases) => {
        const total = releases.reduce(
          (sum: number, r: { assets: { download_count: number }[] }) =>
            sum + r.assets.reduce((a: number, asset: { download_count: number }) => a + asset.download_count, 0),
          0
        );
        setCount(total);
      })
      .catch(() => {});
  }, []);

  if (count === null) return null;

  return (
    <p className="mt-4 text-sm text-gray-400">
      <span className="font-semibold text-gray-600">{count.toLocaleString()}</span> downloads
    </p>
  );
}
