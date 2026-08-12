"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const DEVICE_KEY_STORAGE = "dart-scorekeeper:board-device-key";

export function BoardDeviceReturnControl() {
  const pathname = usePathname();
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    setRegistered(Boolean(window.localStorage.getItem(DEVICE_KEY_STORAGE)));
  }, [pathname]);

  if (!registered || pathname.startsWith("/board-device")) return null;

  return (
    <Link
      href="/board-device"
      className="fixed bottom-4 right-4 z-50 rounded-full border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-4 py-2 text-sm font-bold shadow-lg"
    >
      Board Device
    </Link>
  );
}
