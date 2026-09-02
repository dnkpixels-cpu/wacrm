"use client";

import { useEffect, useState } from "react";

export function useFeatureEntitlements() {
  const [features, setFeatures] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/features", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { features?: string[] };
        if (active) setFeatures(data.features ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return {
    features,
    loading,
    hasFeature: (featureKey: string) => features.includes(featureKey),
  };
}
