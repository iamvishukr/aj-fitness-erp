"use client";

import { useState } from "react";

export function Tabs({ tabs }: { tabs: { key: string; label: string; count: number; content: React.ReactNode }[] }) {
  const firstWithItems = tabs.find((t) => t.count > 0)?.key ?? tabs[0]?.key;
  const [active, setActive] = useState(firstWithItems);
  const cur = tabs.find((t) => t.key === active) ?? tabs[0];
  return (
    <div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-3">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={`shrink-0 chip px-3 py-1.5 text-[13px] border ${
              t.key === active ? "bg-ink text-bg border-ink" : "bg-surface text-muted border-line"
            }`}
          >
            {t.label}
            <span className={`tnum ${t.key === active ? "text-bg/70" : "text-muted/70"}`}>{t.count}</span>
          </button>
        ))}
      </div>
      {cur?.content}
    </div>
  );
}
