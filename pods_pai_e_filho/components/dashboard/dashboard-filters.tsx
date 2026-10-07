"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { buildFilterUrl } from "@/lib/domain/batch-filters";
import { cn } from "@/lib/utils";

export type DashboardFiltersProps = {
  batches: { value: string; label: string }[];
  batchValue: string;
  params: Record<string, string | undefined>;
  periodFrom: string | null;
  periodTo: string | null;
};

export function DashboardFilters({
  batches,
  batchValue,
  params,
  periodFrom,
  periodTo,
}: DashboardFiltersProps) {
  const initialPeriod = params.periodo === "mes" || params.periodo === "personalizado" ? params.periodo : "";
  const [period, setPeriod] = useState(initialPeriod);
  const filterParams = { ...params, lote: batchValue };
  const otherParams = Object.entries(params).filter(([key, value]) =>
    value !== undefined && !["lote", "periodo", "de", "ate"].includes(key),
  );

  return (
    <form action="/inicio" method="get" className="grid w-full min-w-0 gap-3">
      {otherParams.map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
      <div className="segmented w-full sm:w-fit">
        <Link
          href={buildFilterUrl("/inicio", filterParams, { periodo: undefined, de: undefined, ate: undefined })}
          className="segmented-item min-h-8 px-3"
          data-active={initialPeriod === ""}
        >
          Tudo
        </Link>
        <Link
          href={buildFilterUrl("/inicio", filterParams, { periodo: "mes", de: undefined, ate: undefined })}
          className="segmented-item min-h-8 px-3"
          data-active={initialPeriod === "mes"}
        >
          Este mês
        </Link>
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(12rem,1.4fr)_minmax(10rem,1fr)_minmax(9.5rem,1fr)_minmax(9.5rem,1fr)_auto] xl:items-end">
        <label className="grid min-w-0 gap-1 text-sm font-medium">
          Lote
          <select name="lote" defaultValue={batchValue} className={cn(controlClass, "h-10 w-full min-w-0")}>
            <option value="todos">Todos os lotes</option>
            {batches.map((batch) => <option key={batch.value} value={batch.value}>{batch.label}</option>)}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-medium">
          Período
          <select name="periodo" value={period} onChange={(event) => setPeriod(event.target.value)} className={cn(controlClass, "h-10 w-full min-w-0")}>
            <option value="">Todo o período</option>
            <option value="mes">Este mês</option>
            <option value="personalizado">Personalizado</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-medium">
          De
          <input
            className={cn(controlClass, "h-10 w-full min-w-0")}
            type="date"
            name="de"
            defaultValue={params.de ?? periodFrom ?? ""}
            onChange={() => setPeriod("personalizado")}
          />
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-medium">
          Até
          <input
            className={cn(controlClass, "h-10 w-full min-w-0")}
            type="date"
            name="ate"
            defaultValue={params.ate ?? periodTo ?? ""}
            onChange={() => setPeriod("personalizado")}
          />
        </label>
        <button className={cn(buttonVariants({ variant: "secondary" }), "h-10 w-full sm:col-span-2 xl:col-span-1 xl:w-auto")} type="submit">
          Filtrar
        </button>
      </div>
    </form>
  );
}
