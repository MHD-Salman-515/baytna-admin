import type { ReactNode } from "react";

/** Keeps phone numbers, IDs and codes left-to-right inside RTL text. */
export function Ltr({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={`ltr-text ${className}`}>
      {children}
    </bdi>
  );
}
