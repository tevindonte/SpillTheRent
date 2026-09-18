"use client";

import { useEffect, useState } from "react";
import { isInServiceArea } from "@/lib/nyc-service-area";

/** One-time browser geolocation check; does not move the map. */
export function useUserOutsideNyc(): boolean | null {
  const [outside, setOutside] = useState<boolean | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setOutside(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOutside(
          !isInServiceArea(pos.coords.latitude, pos.coords.longitude)
        );
      },
      () => setOutside(false),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  }, []);

  return outside;
}
