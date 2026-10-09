import { Product, Invoice, InvoiceItem, Customer, Voucher, Gift, StockMovement } from '@/types';

/**
 * Escapes a cell value for standard CSV
 */
function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts array of objects to CSV string
 */
export function convertToCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const rowLines = rows.map((r) => r.map(escapeCsvCell).join(','));
  return [headerLine, ...rowLines].join('\r\n');
}

/**
 * Triggers browser download of a CSV file
 */
export function downloadCsvFile(filename: string, csvContent: string): void {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates sample CSV template for Product Import
 */
export function getProductCsvTemplate(): string {
  const headers = ['item_number', 'name', 'category', 'size', 'color', 'price', 'quantity'];
  const samples = [
    ['847291', 'Floral Satin Crop Top', 'Tops', 'M', 'Rose Pink', 450, 1],
    ['847305', 'Embroidered Velvet Bustier', 'Tops', 'S', 'Burgundy', 400, 1],
    ['912004', 'High-Rise Flared Denim', 'Jeans', '28', 'Indigo', 500, 2],
    ['004812', 'Boho Chiffon Maxi Dress', 'Dresses', 'L', 'Ivory', 1200, 1],
  ];
  return convertToCsv(headers, samples);
}

export interface CsvImportRowResult {
  rowNumber: number;
  data: Partial<Product>;
  isValid: boolean;
  errors: string[];
}

/**
 * Parses and validates CSV content for Product Import (INV-4)
 */
export function parseProductCsv(csvText: string): {
  totalRows: number;
  validRows: Product[];
  results: CsvImportRowResult[];
} {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { totalRows: 0, validRows: [], results: [] };
  }

  // Parse headers
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
  const itemNoIdx = headers.indexOf('item_number');
  const nameIdx = headers.indexOf('name');
  const catIdx = headers.indexOf('category');
  const sizeIdx = headers.indexOf('size');
  const colorIdx = headers.indexOf('color');
  const priceIdx = headers.indexOf('price');
  const qtyIdx = headers.indexOf('quantity');

  const results: CsvImportRowResult[] = [];
  const validRows: Product[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    // Split by comma while respecting quotes
    const regex = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^,]*))/g;
    const cols: string[] = [];
    let match;
    while ((match = regex.exec(rawLine)) !== null) {
      if (match.index === regex.lastIndex) regex.lastIndex++;
      const val = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
      cols.push(val !== undefined ? val.trim() : '');
    }

    const errors: string[] = [];
    const itemNumber = itemNoIdx >= 0 && cols[itemNoIdx] ? cols[itemNoIdx] : '';
    const name = nameIdx >= 0 && cols[nameIdx] ? cols[nameIdx] : '';
    const category = catIdx >= 0 && cols[catIdx] ? cols[catIdx] : 'General';
    const size = sizeIdx >= 0 && cols[sizeIdx] ? cols[sizeIdx] : 'Free Size';
    const color = colorIdx >= 0 && cols[colorIdx] ? cols[colorIdx] : 'Standard';
    const priceStr = priceIdx >= 0 && cols[priceIdx] ? cols[priceIdx] : '';
    const qtyStr = qtyIdx >= 0 && cols[qtyIdx] ? cols[qtyIdx] : '1';

    if (!itemNumber) {
      errors.push('Missing item_number');
    }

    if (!name) {
      errors.push('Missing item name');
    }

    const price = parseInt(priceStr, 10);
    if (isNaN(price) || price < 0) {
      errors.push('Price must be a positive whole integer');
    }

    const quantity = parseInt(qtyStr, 10);
    if (isNaN(quantity) || quantity < 0) {
      errors.push('Quantity must be an integer >= 0');
    }

    const isValid = errors.length === 0;
    const productData: Product = {
      id: '',
      item_number: itemNumber,
      name,
      category,
      size,
      color,
      price: isNaN(price) ? 0 : price,
      quantity_on_hand: isNaN(quantity) ? 1 : quantity,
      is_active: true,
    };

    results.push({
      rowNumber: i + 1,
      data: productData,
      isValid,
      errors,
    });

    if (isValid) {
      validRows.push(productData);
    }
  }

  return {
    totalRows: lines.length - 1,
    validRows,
    results,
  };
}

/**
 * Prepares and triggers export of all tables (RPT-3)
 */
export function exportAllDataToCsv(data: {
  products: Product[];
  invoices: Invoice[];
  invoiceItems: InvoiceItem[];
  customers: Customer[];
  vouchers: Voucher[];
  gifts: Gift[];
  stockMovements: StockMovement[];
}): void {
  const timestamp = new Date().toISOString().slice(0, 10);

  // 1. Products
  const prodHeaders = ['id', 'item_number', 'name', 'category', 'size', 'color', 'price_rs', 'quantity_on_hand', 'is_active'];
  const prodRows = data.products.map((p) => [
    p.id, p.item_number, p.name, p.category, p.size, p.color, p.price, p.quantity_on_hand, p.is_active
  ]);
  downloadCsvFile(`trendy_products_${timestamp}.csv`, convertToCsv(prodHeaders, prodRows));

  // 2. Invoices
  const invHeaders = [
    'invoice_number', 'client_request_id', 'customer_id', 'subtotal_rs',
    'discount_rs', 'voucher_rs', 'grand_total_rs', 'payment_mode', 'status', 'finalized_at'
  ];
  const invRows = data.invoices.map((inv) => [
    inv.invoice_number, inv.client_request_id, inv.customer_id, inv.subtotal,
    inv.discount_total, inv.voucher_total, inv.grand_total, inv.payment_mode, inv.status, inv.finalized_at
  ]);
  downloadCsvFile(`trendy_invoices_${timestamp}.csv`, convertToCsv(invHeaders, invRows));

  // 3. Invoice Items
  const lineHeaders = ['invoice_id', 'product_id', 'item_number', 'description', 'quantity', 'unit_price_rs', 'line_total_rs'];
  const lineRows = data.invoiceItems.map((li) => [
    li.invoice_id, li.product_id, li.item_number_snapshot, li.description_snapshot, li.quantity, li.unit_price_snapshot, li.line_total
  ]);
  downloadCsvFile(`trendy_invoice_lines_${timestamp}.csv`, convertToCsv(lineHeaders, lineRows));

  // 4. Customers
  const custHeaders = ['id', 'phone_e164', 'name', 'instagram_handle', 'marketing_consent', 'consent_at', 'created_at'];
  const custRows = data.customers.map((c) => [
    c.id, c.phone_e164, c.name || '', c.instagram_handle || '', c.marketing_consent, c.consent_at || '', c.created_at || ''
  ]);
  downloadCsvFile(`trendy_customers_${timestamp}.csv`, convertToCsv(custHeaders, custRows));

  // 5. Vouchers
  const vouchHeaders = ['code', 'source_invoice_id', 'customer_id', 'face_value_rs', 'min_purchase_rs', 'status', 'expires_at', 'redeemed_at'];
  const vouchRows = data.vouchers.map((v) => [
    v.code, v.source_invoice_id, v.customer_id, v.face_value, v.min_purchase || 0, v.status, v.expires_at || '', v.redeemed_at || ''
  ]);
  downloadCsvFile(`trendy_vouchers_${timestamp}.csv`, convertToCsv(vouchHeaders, vouchRows));

  // 6. Gifts
  const giftHeaders = ['source_invoice_id', 'customer_id', 'description', 'status', 'collected_at'];
  const giftRows = data.gifts.map((g) => [
    g.source_invoice_id, g.customer_id, g.description, g.status, g.collected_at || ''
  ]);
  downloadCsvFile(`trendy_gifts_${timestamp}.csv`, convertToCsv(giftHeaders, giftRows));

  // 7. Stock Movements
  const moveHeaders = ['id', 'product_id', 'delta', 'reason', 'invoice_id', 'note', 'created_at'];
  const moveRows = data.stockMovements.map((m) => [
    m.id, m.product_id, m.delta, m.reason, m.invoice_id || '', m.note || '', m.created_at
  ]);
  downloadCsvFile(`trendy_stock_movements_${timestamp}.csv`, convertToCsv(moveHeaders, moveRows));
}
