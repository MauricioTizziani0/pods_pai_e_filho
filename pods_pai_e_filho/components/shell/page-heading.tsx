import Link from "next/link";

export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl leading-none md:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? (
        <Link
          href={action.href}
          className="inline-flex h-11 shrink-0 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
