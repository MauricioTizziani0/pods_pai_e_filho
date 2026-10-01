"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { IceBadge } from "@/components/sales/badges";
import { cn } from "@/lib/utils";

export function FlavorIceCheckbox({
  checked,
  onCheckedChange,
  disabled,
  id,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex min-h-11 min-w-0 cursor-pointer items-center gap-3 rounded-lg border bg-surface px-3 transition-[border-color,box-shadow,background-color]",
        checked ? "border-info/50 bg-info/10 shadow-glow-sm" : "border-input hover:border-primary/40",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <span className="text-sm font-medium">É Ice</span>
      {checked ? <span className="ml-auto" aria-hidden><IceBadge /></span> : null}
    </label>
  );
}
