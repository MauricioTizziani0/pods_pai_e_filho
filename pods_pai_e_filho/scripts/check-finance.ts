import {
  previewSale,
  stockDeltaOnSale,
  summarizeSales,
  type SaleFigures,
} from "../lib/domain/finance.ts";

function assertEqual(actual: number, expected: number, label: string) {
  if (Math.abs(actual - expected) > 0.001) {
    throw new Error(`${label}: esperado ${expected}, recebido ${actual}`);
  }
}

function sale(partial: SaleFigures): SaleFigures {
  return partial;
}

const fiado = sale({
  total: 150,
  transfer: 125,
  profit: 25,
  quantity: 1,
  received: false,
  isCredit: true,
  transferPaid: false,
  cancelled: false,
});

const fiadoIndicators = summarizeSales([fiado]);
assertEqual(fiadoIndicators.receivable, 150, "fiado a receber");
assertEqual(fiadoIndicators.moneyReceived, 0, "fiado dinheiro");
assertEqual(fiadoIndicators.profitTotal, 25, "fiado lucro total");
assertEqual(fiadoIndicators.profitReceived, 0, "fiado lucro recebido");
assertEqual(fiadoIndicators.transferDueNow, 125, "fiado a enviar");
assertEqual(fiadoIndicators.transferFuture, 0, "fiado futuro");
assertEqual(stockDeltaOnSale(1), -1, "baixa de estoque");

const fiadoPaid = summarizeSales([{ ...fiado, received: true }]);
assertEqual(fiadoPaid.receivable, 0, "fiado pago a receber");
assertEqual(fiadoPaid.moneyReceived, 150, "fiado pago dinheiro");
assertEqual(fiadoPaid.profitReceived, 25, "fiado pago lucro");
assertEqual(fiadoPaid.transferDueNow, 125, "fiado pago não duplica repasse");

const fiadoSettled = summarizeSales([{ ...fiado, received: true, transferPaid: true }]);
assertEqual(fiadoSettled.transferDueNow, 0, "fiado repasse pago");
assertEqual(fiadoSettled.moneyReceived, 150, "fiado repasse pago dinheiro");

const future = sale({
  total: 140,
  transfer: 115,
  profit: 25,
  quantity: 1,
  received: false,
  isCredit: false,
  transferPaid: false,
  cancelled: false,
});
const futureIndicators = summarizeSales([future]);
assertEqual(futureIndicators.receivable, 140, "futuro a receber");
assertEqual(futureIndicators.transferFuture, 115, "futuro repasse");
assertEqual(futureIndicators.transferDueNow, 0, "futuro a enviar");
assertEqual(futureIndicators.profitReceived, 0, "futuro lucro recebido");

const futureReceived = summarizeSales([{ ...future, received: true }]);
assertEqual(futureReceived.transferFuture, 0, "futuro migra");
assertEqual(futureReceived.transferDueNow, 115, "futuro vira a enviar");
assertEqual(futureReceived.moneyReceived, 140, "futuro dinheiro");
assertEqual(futureReceived.profitReceived, 25, "futuro lucro recebido");

const amigo = sale({
  total: 130,
  transfer: 125,
  profit: 5,
  quantity: 1,
  received: true,
  isCredit: false,
  transferPaid: false,
  cancelled: false,
});
const amigoIndicators = summarizeSales([amigo]);
assertEqual(amigoIndicators.moneyReceived, 130, "amigo dinheiro");
assertEqual(amigoIndicators.profitReceived, 5, "amigo lucro");
assertEqual(amigoIndicators.profitTotal, 5, "amigo lucro total");
assertEqual(amigoIndicators.transferDueNow, 125, "amigo a enviar");

const amigoSettled = summarizeSales([{ ...amigo, transferPaid: true }]);
assertEqual(amigoSettled.transferDueNow, 0, "amigo repasse pago");
assertEqual(amigoSettled.profitReceived, 5, "amigo lucro permanece");

const cancelled = summarizeSales([{ ...amigo, cancelled: true }]);
assertEqual(cancelled.moneyReceived, 0, "cancelada sai dos indicadores");
assertEqual(cancelled.transferDueNow, 0, "cancelada sem repasse ativo");
assertEqual(cancelled.profitTotal, 0, "cancelada sem lucro ativo");

const preview = previewSale({
  unitCost: 100,
  unitPrice: 150,
  unitTransfer: 125,
  quantity: 2,
  received: false,
  isCredit: true,
});
assertEqual(preview.unitProfit, 25, "lucro unitário");
assertEqual(preview.unitFatherProfit, 25, "lucro unitário do pai");
assertEqual(preview.total, 300, "total");
assertEqual(preview.cost, 200, "custo total");
assertEqual(preview.transfer, 250, "repasse");
assertEqual(preview.profit, 50, "lucro");
assertEqual(preview.fatherProfit, 50, "lucro total do pai");
assertEqual(preview.totalProfit, 100, "lucro total da operação");
assertEqual(preview.indicators.transferDueNow, 250, "preview fiado");

const receivedPreview = previewSale({
  unitCost: 100,
  unitPrice: 130,
  unitTransfer: 125,
  quantity: 1,
  received: true,
  isCredit: true,
});
if (receivedPreview.isCredit) {
  throw new Error("Venda já recebida não permanece fiada na criação.");
}

for (const invalid of [
  { unitCost: -1, unitTransfer: 125, unitPrice: 150 },
  { unitCost: 130, unitTransfer: 125, unitPrice: 150 },
  { unitCost: 100, unitTransfer: 125, unitPrice: 120 },
]) {
  let rejected = false;
  try {
    previewSale({ ...invalid, quantity: 1, received: true, isCredit: false });
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error("Preço inconsistente deveria ter sido recusado.");
}

console.log("Regras financeiras conferidas.");
