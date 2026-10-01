import * as React from "react";

import { cn } from "@/lib/utils";

const inputClass =
  "flex h-11 w-full min-w-0 max-w-full rounded-md border border-input bg-surface px-3 py-1 text-base text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.02)] transition-[border-color,box-shadow,background-color] duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/80 hover:border-input/80 hover:bg-surface-2 focus-visible:border-primary focus-visible:outline-none focus-visible:shadow-glow-sm focus-visible:ring-1 focus-visible:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return <input type={type} className={cn(inputClass, className)} ref={ref} {...props} />;
  },
);
Input.displayName = "Input";

export { Input, inputClass };
