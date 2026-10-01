export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  role_code: string;
  role_name: string;
  can_write: boolean;
};

export type CustomerType = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  sort_order: number;
};

export type PaymentStatus = {
  id: string;
  code: string;
  name: string;
  counts_as_received: boolean;
  counts_as_receivable: boolean;
  is_terminal: boolean;
  active: boolean;
  sort_order: number;
};

export type Product = {
  id: string;
  name: string;
  brand: string;
  model: string;
  approximate_puffs: number | null;
  active: boolean;
};

export type ProductVariant = {
  id: string;
  product_id: string;
  name: string;
  active: boolean;
};

export type PriceRule = {
  id: string;
  product_id: string;
  customer_type_id: string;
  sale_price: string;
  father_transfer: string;
  unit_profit: string;
  active: boolean;
};

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  customer_type_id: string | null;
  active: boolean;
};

export type StockBalance = {
  variant_id: string;
  variant_name: string;
  variant_active: boolean;
  product_id: string;
  product_name: string;
  brand: string;
  model: string;
  approximate_puffs: number | null;
  product_active: boolean;
  quantity: number;
};

export type StockMovement = {
  id: string;
  movement_type: string;
  movement_name: string;
  direction: number;
  quantity: number;
  movement_date: string;
  sale_id: string | null;
  notes: string | null;
  created_at: string;
  product_name: string;
  variant_name: string;
  user_name: string | null;
};

export type SaleOverview = {
  id: string;
  sale_date: string;
  customer_id: string | null;
  customer_name: string;
  customer_type_id: string;
  customer_type_name: string;
  payment_status_id: string;
  is_credit: boolean;
  notes: string | null;
  total_amount: string;
  transfer_amount: string;
  profit_amount: string;
  transfer_paid: boolean;
  transfer_paid_at: string | null;
  transfer_id: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  created_by: string | null;
  created_at: string;
  payment_status_code: string;
  payment_status_name: string;
  counts_as_received: boolean;
  counts_as_receivable: boolean;
  is_terminal: boolean;
  is_valid: boolean;
  transfer_due_now: boolean;
  transfer_is_future: boolean;
  quantity: number;
  items_label: string;
  product_id: string | null;
  product_name: string | null;
  variant_id: string | null;
  variant_name: string | null;
  unit_price: string | null;
  unit_transfer: string | null;
  unit_profit: string | null;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  variant_id: string;
  variant_name: string;
  quantity: number;
  unit_price: string;
  unit_transfer: string;
  unit_profit: string;
  line_total: string;
  line_transfer: string;
  line_profit: string;
};

export type AuditLog = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user_name?: string | null;
};

export type Metrics = {
  money_received: string;
  receivable: string;
  profit_received: string;
  profit_total: string;
  transfer_from_received: string;
  transfer_future: string;
  transfer_due_now: string;
  transfer_total: string;
  sales_count: number;
  units_sold: number;
};

export type ReportRow = {
  name: string;
  quantity: number;
  revenue: string;
  transfer: string;
  profit: string;
  stock?: number;
};

export type SalesReport = {
  by_customer_type: ReportRow[];
  by_status: ReportRow[];
  by_product: ReportRow[];
};

export type StockDivergence = {
  variant_id: string;
  product_id: string;
  product_name: string;
  variant_name: string;
  system_quantity: number;
  physical_quantity: number;
  difference: number;
  counted_at: string;
};

export type TransferRecord = {
  id: string;
  paid_at: string;
  notes: string | null;
  total_amount: string;
  payer_name: string | null;
};

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; message: string };

export type CatalogSnapshot = {
  products: Product[];
  variants: ProductVariant[];
  customerTypes: CustomerType[];
  statuses: PaymentStatus[];
  prices: PriceRule[];
  customers: Customer[];
  stock: StockBalance[];
};
