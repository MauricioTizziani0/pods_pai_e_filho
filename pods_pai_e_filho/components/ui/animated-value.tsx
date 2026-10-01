"use client";

import { useEffect, useRef, useState } from "react";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

function format(value: number, kind: "brl" | "int") {
  return kind === "brl" ? brl.format(value) : int.format(Math.round(value));
}

/**
 * Número que "sobe" suavemente até o valor final ao montar.
 * Renderiza o valor final no servidor (sem JS) e anima só no cliente.
 */
export function AnimatedValue({
  value,
  kind = "brl",
  duration = 650,
  className,
}: {
  value: number;
  kind?: "brl" | "int";
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const previous = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = previous.current ?? 0;
    previous.current = value;
    if (reduce || from === value) {
      setDisplay(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return (
    <span className={className} aria-label={format(value, kind)}>
      {format(display, kind)}
    </span>
  );
}
