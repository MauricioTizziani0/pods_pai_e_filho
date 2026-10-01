import {
  flavorSearchOrFilter,
  getFlavorDisplayName,
  matchesFlavorSearch,
  matchesIceFilter,
  normalizeFlavorName,
  parseIceParam,
} from "../lib/domain/flavors.ts";

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: esperado ${JSON.stringify(expected)}, recebido ${JSON.stringify(actual)}`);
  }
}

assertEqual(normalizeFlavorName("Grape Ice", true), "Grape", "normaliza Grape Ice marcado");
assertEqual(normalizeFlavorName("Grape Ice Ice", true), "Grape", "normaliza Ice duplicado");
assertEqual(normalizeFlavorName("Ice", true), "Ice", "mantém Ice sozinho");
assertEqual(normalizeFlavorName("Grape Ice", false), "Grape Ice", "não remove Ice desmarcado");
assertEqual(getFlavorDisplayName({ name: "Grape", is_ice: true }), "Grape Ice", "exibe Grape Ice");
assertEqual(getFlavorDisplayName({ name: "Grape Ice", is_ice: true }), "Grape Ice", "não duplica Ice");
assertEqual(getFlavorDisplayName({ name: "Watermelon", is_ice: false }), "Watermelon", "exibe normal");
assertEqual(matchesFlavorSearch({ name: "Grape", is_ice: true }, "ice"), true, "pesquisa ice");
assertEqual(matchesFlavorSearch({ name: "Grape", is_ice: true }, "Grape Ice"), true, "pesquisa Grape Ice");
assertEqual(matchesFlavorSearch({ name: "Watermelon", is_ice: false }, "ice"), false, "não ice na pesquisa ice");
assertEqual(matchesIceFilter(true, "ice"), true, "filtro ice");
assertEqual(matchesIceFilter(false, "nao_ice"), true, "filtro não ice");
assertEqual(parseIceParam("sim"), "ice", "param sim");
assertEqual(flavorSearchOrFilter("Grape Ice")?.includes("variant_is_ice.eq.true"), true, "or filter grape ice");
assertEqual(flavorSearchOrFilter("ice")?.includes("variant_is_ice.eq.true"), true, "or filter ice");

console.log("check-flavors: ok");
