import type { ReactNode } from "react";

/**
 * The coach destination board: the yellow plate every Indian Railways coach carries beside its door, with the train
 * number, its name and where it runs, lettered in black. It heads every train, ticket, plan and payment on the site.
 */
export function CoachBoard({ number, name, from, to, size = "md", as: Tag = "div", children }: {
  number: string;
  name: ReactNode;
  from?: string;
  to?: string;
  size?: "sm" | "md" | "lg";
  as?: "div" | "h1" | "h2" | "h3";
  /** extra content on the right edge of the board (badges, links, status) */
  children?: ReactNode;
}) {
  const s = {
    sm: { pad: "px-3 py-1.5", num: "text-[1.5rem]", name: "text-[1.2rem]", route: "text-[1.05rem]" },
    md: { pad: "px-5 py-2.5", num: "text-[2.2rem]", name: "text-[1.6rem]", route: "text-[1.3rem]" },
    lg: { pad: "px-6 py-3.5", num: "text-[3rem]", name: "text-[2.2rem]", route: "text-[1.6rem]" },
  }[size];
  return (
    <div className={`flex items-center gap-x-4 gap-y-1 bg-accent text-ink ${s.pad}`}>
      <Tag className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-4 gap-y-0.5 font-sign uppercase leading-none tracking-[0.03em]">
        <span className={`${s.num} tracking-[0.05em]`}>{number}</span>
        <span className={`${s.name} min-w-0`}>{name}</span>
        {from && to && (
          <span className={`${s.route} whitespace-nowrap text-ink/80`}>
            {from} <span aria-hidden>→</span> {to}
          </span>
        )}
      </Tag>
      {children && <div className="flex shrink-0 items-center gap-3">{children}</div>}
    </div>
  );
}
