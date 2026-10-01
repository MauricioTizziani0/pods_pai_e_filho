import {
  getLowStockProducts,
  summarizeActiveProductStock,
} from "../lib/domain/stock.ts";
import type { Product, StockBalance } from "../lib/types.ts";

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: esperado ${JSON.stringify(expected)}, recebido ${JSON.stringify(actual)}`);
  }
}

function product(id: string, active = true): Product {
  return {
    id,
    name: id,
    brand: "",
    model: "",
    approximate_puffs: null,
    active,
  };
}

function balance(
  productId: string,
  variantId: string,
  quantity: number,
  options: { productActive?: boolean; variantActive?: boolean } = {},
): StockBalance {
  return {
    variant_id: variantId,
    variant_name: variantId,
    variant_active: options.variantActive ?? true,
    variant_is_ice: false,
    product_id: productId,
    product_name: productId,
    brand: "",
    model: "",
    approximate_puffs: null,
    product_active: options.productActive ?? true,
    quantity,
  };
}

function lowProductIds(products: Product[], balances: StockBalance[], threshold: number) {
  return getLowStockProducts(summarizeActiveProductStock(products, balances), threshold).map(
    (item) => item.product_id,
  );
}

// Scenario 1: two individual quantities of 1 add to 2, so the product is not low.
assertEqual(
  lowProductIds([product("Pod 40k")], [balance("Pod 40k", "Uva", 1), balance("Pod 40k", "Morango", 1)], 1),
  [],
  "cenário 1: soma das variações acima do limite",
);

// Scenario 2: a single active flavor at 1 leaves the product at the threshold.
assertEqual(
  lowProductIds([product("Pod 30k")], [balance("Pod 30k", "Melancia", 1)], 1),
  ["Pod 30k"],
  "cenário 2: produto no limite",
);

// Scenario 3: one sold-out flavor does not make a product with stock unavailable.
assertEqual(
  lowProductIds([product("Pod 40k")], [balance("Pod 40k", "Uva", 0), balance("Pod 40k", "Morango", 2)], 1),
  [],
  "cenário 3: sabor zerado e produto com saldo",
);

// Scenario 4: all flavors at zero means the product is out of stock.
const soldOut = summarizeActiveProductStock(
  [product("Pod 40k")],
  [balance("Pod 40k", "Uva", 0), balance("Pod 40k", "Morango", 0)],
);
assertEqual(soldOut[0]?.quantity, 0, "cenário 4: saldo total zerado");
assertEqual(getLowStockProducts(soldOut, 1).map((item) => item.product_id), ["Pod 40k"], "cenário 4: produto esgotado em alerta");

// Scenario 5: equality with the configured threshold must alert.
assertEqual(
  lowProductIds(
    [product("Pod 40k")],
    [balance("Pod 40k", "Uva", 1), balance("Pod 40k", "Morango", 1), balance("Pod 40k", "Melancia", 1)],
    3,
  ),
  ["Pod 40k"],
  "cenário 5: igualdade com limite 3",
);

// Scenario 6: a total of 4 stays above a threshold of 3.
assertEqual(
  lowProductIds([product("Pod 40k")], [balance("Pod 40k", "Uva", 2), balance("Pod 40k", "Morango", 2)], 3),
  [],
  "cenário 6: total acima do limite 3",
);

// Products without variants have a zero balance; inactive products/variants do not count.
const edgeCases = summarizeActiveProductStock(
  [product("Sem variações"), product("Inativo", false)],
  [
    balance("Inativo", "Flavor", 10),
    balance("Com variação inativa", "Disabled", 10, { productActive: true, variantActive: false }),
  ],
);
assertEqual(edgeCases.map((item) => [item.product_id, item.quantity]), [["Sem variações", 0]], "produtos sem variações e inativos");

console.log("check-stock: ok");
