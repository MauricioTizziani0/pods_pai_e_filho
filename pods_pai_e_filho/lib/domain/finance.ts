/**
 * Regras de indicadores. O banco aplica as mesmas condições em
 * `sales_overview` e `dashboard_metrics`. Este módulo existe para o resumo
 * da venda na tela e para os testes dos exemplos da especificação.
 *
 * A enviar agora = repasse não pago AND (recebido OR fiado)
 * Repasse futuro = a receber AND não fiado AND repasse não pago
 * Lucro unitário = preço − repasse. Nunca é digitado.
 */

export type SaleFigures = {
  total: number;
  transfer: number;
  profit: number;
  quantity: number;
  received: boolean;
  isCredit: boolean;
  transferPaid: boolean;
  cancelled: boolean;
};

export type IndicatorTotals = {
  moneyReceived: number;
  receivable: number;
  profitReceived: number;
  profitTotal: number;
  transferFromReceived: number;
  transferFuture: number;
  transferDueNow: number;
  transferTotal: number;
  units: number;
};

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sum(sales: SaleFigures[], pick: (sale: SaleFigures) => number) {
  const cents = sales.reduce((total, sale) => total + Math.round(pick(sale) * 100), 0);
  return cents / 100;
}

export function isTransferDueNow(sale: SaleFigures) {
  return !sale.cancelled && !sale.transferPaid && (sale.received || sale.isCredit);
}

export function isTransferFuture(sale: SaleFigures) {
  return !sale.cancelled && !sale.transferPaid && !sale.received && !sale.isCredit;
}

export function summarizeSales(sales: SaleFigures[]): IndicatorTotals {
  const valid = sales.filter((sale) => !sale.cancelled);
  return {
    moneyReceived: sum(valid.filter((sale) => sale.received), (sale) => sale.total),
    receivable: sum(valid.filter((sale) => !sale.received), (sale) => sale.total),
    profitReceived: sum(valid.filter((sale) => sale.received), (sale) => sale.profit),
    profitTotal: sum(valid, (sale) => sale.profit),
    transferFromReceived: sum(valid.filter((sale) => sale.received), (sale) => sale.transfer),
    transferFuture: sum(valid.filter(isTransferFuture), (sale) => sale.transfer),
    transferDueNow: sum(valid.filter(isTransferDueNow), (sale) => sale.transfer),
    transferTotal: sum(valid, (sale) => sale.transfer),
    units: valid.reduce((total, sale) => total + sale.quantity, 0),
  };
}

export function unitProfit(unitPrice: number, unitTransfer: number) {
  return roundMoney(unitPrice - unitTransfer);
}

/** Baixa acontece na confirmação da venda, independente do pagamento. */
export function stockDeltaOnSale(quantity: number) {
  return -quantity;
}

export type SalePreview = {
  unitPrice: number;
  unitTransfer: number;
  unitProfit: number;
  quantity: number;
  total: number;
  transfer: number;
  profit: number;
  received: boolean;
  isCredit: boolean;
  indicators: IndicatorTotals;
  transferLabel: string;
};

export function previewSale(input: {
  unitPrice: number;
  unitTransfer: number;
  quantity: number;
  received: boolean;
  isCredit: boolean;
}): SalePreview {
  if (input.unitPrice < input.unitTransfer) {
    throw new Error("O preço de venda não pode ser menor que o repasse ao pai.");
  }
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new Error("Quantidade inválida.");
  }

  const profitPerUnit = unitProfit(input.unitPrice, input.unitTransfer);
  const isCredit = input.received ? false : input.isCredit;
  const sale: SaleFigures = {
    total: roundMoney(input.unitPrice * input.quantity),
    transfer: roundMoney(input.unitTransfer * input.quantity),
    profit: roundMoney(profitPerUnit * input.quantity),
    quantity: input.quantity,
    received: input.received,
    isCredit,
    transferPaid: false,
    cancelled: false,
  };

  return {
    unitPrice: input.unitPrice,
    unitTransfer: input.unitTransfer,
    unitProfit: profitPerUnit,
    quantity: input.quantity,
    total: sale.total,
    transfer: sale.transfer,
    profit: sale.profit,
    received: input.received,
    isCredit,
    indicators: summarizeSales([sale]),
    transferLabel: isTransferDueNow(sale)
      ? "A enviar ao pai agora"
      : isTransferFuture(sale)
        ? "Repasse futuro"
        : "Sem repasse pendente",
  };
}
