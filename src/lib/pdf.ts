import jsPDF from 'jspdf';
import { Invoice, InvoiceItem, Voucher, Gift, Customer } from '@/types';
import { formatDisplayDate } from './whatsapp';

export interface GenerateInvoicePdfOptions {
  invoice: Invoice;
  items: InvoiceItem[];
  customer?: Customer;
  vouchers?: Voucher[];
  gift?: Gift | null;
}

/**
 * Generates high-fidelity Invoice PDF in the browser (DOC-1)
 * Adheres to FEVER Trendy Collection branding, clean fashion receipt styling,
 * no GSTIN, full line item details and reward summary.
 */
export function generateInvoicePdf(options: GenerateInvoicePdfOptions): jsPDF {
  const { invoice, items, customer, vouchers = [], gift } = options;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5', // Standard compact receipt/invoice size (148 x 210 mm)
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 16;

  // Header Branding - FEVER
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(225, 29, 72); // FEVER crimson
  doc.text('FEVER', pageWidth / 2, y, { align: 'center' });
  y += 6;

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('TRENDY COLLECTION • POP-UP EXHIBITION', pageWidth / 2, y, { align: 'center' });
  y += 8;

  // Divider Line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(12, y, pageWidth - 12, y);
  y += 6;

  // Invoice Meta
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(`INVOICE: ${invoice.invoice_number}`, 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`DATE: ${formatDisplayDate(invoice.finalized_at)}`, pageWidth - 14, y, { align: 'right' });
  y += 5;

  // Customer Meta
  if (customer) {
    const custName = customer.name ? customer.name : 'Valued Customer';
    doc.text(`CUSTOMER: ${custName} (${customer.phone_e164})`, 14, y);
  } else {
    doc.text(`CUSTOMER: Walk-in Shopper`, 14, y);
  }
  doc.text(`PAYMENT: ${invoice.payment_mode}`, pageWidth - 14, y, { align: 'right' });
  y += 7;

  // Table Header
  doc.setFillColor(248, 250, 252);
  doc.rect(12, y, pageWidth - 24, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('ITEM & DESCRIPTION', 14, y + 4.5);
  doc.text('QTY', pageWidth - 46, y + 4.5, { align: 'center' });
  doc.text('RATE', pageWidth - 30, y + 4.5, { align: 'right' });
  doc.text('TOTAL', pageWidth - 14, y + 4.5, { align: 'right' });
  y += 9;

  // Table Rows
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  items.forEach((item) => {
    const itemTitle = `${item.description_snapshot} (#${item.item_number_snapshot})`;
    const truncatedTitle = itemTitle.length > 36 ? itemTitle.slice(0, 34) + '…' : itemTitle;
    doc.text(truncatedTitle, 14, y);
    doc.text(String(item.quantity), pageWidth - 46, y, { align: 'center' });
    doc.text(`Rs ${item.unit_price_snapshot}`, pageWidth - 30, y, { align: 'right' });
    doc.text(`Rs ${item.line_total}`, pageWidth - 14, y, { align: 'right' });
    y += 5.5;
  });

  y += 2;
  doc.setDrawColor(226, 232, 240);
  doc.line(12, y, pageWidth - 12, y);
  y += 6;

  // Calculation Breakdown
  const rightColX = pageWidth - 14;
  const labelColX = pageWidth - 55;

  doc.setFontSize(8.5);
  doc.text('Subtotal:', labelColX, y);
  doc.text(`Rs ${invoice.subtotal}`, rightColX, y, { align: 'right' });
  y += 5;

  if (invoice.discount_total > 0) {
    doc.setTextColor(225, 29, 72);
    doc.text('Owner Discount:', labelColX, y);
    doc.text(`-Rs ${invoice.discount_total}`, rightColX, y, { align: 'right' });
    doc.setTextColor(15, 23, 42);
    y += 5;
  }

  if (invoice.voucher_total > 0) {
    doc.setTextColor(225, 29, 72);
    doc.text('Voucher Applied:', labelColX, y);
    doc.text(`-Rs ${invoice.voucher_total}`, rightColX, y, { align: 'right' });
    doc.setTextColor(15, 23, 42);
    y += 5;
  }

  // Grand Total Box
  doc.setFillColor(241, 245, 249);
  doc.rect(labelColX - 3, y - 1, (pageWidth - 12) - (labelColX - 3), 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Grand Total:', labelColX, y + 4.5);
  doc.text(`Rs ${invoice.grand_total}`, rightColX, y + 4.5, { align: 'right' });
  y += 14;

  // Rewards Section
  const hasVouchers = vouchers && vouchers.length > 0;
  const hasGift = !!gift;

  if (hasVouchers || hasGift) {
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(12, y, pageWidth - 24, 24 + (vouchers.length * 4), 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(225, 29, 72);
    doc.text('★ YOUR REWARDS & VOUCHERS', 16, y + 5.5);
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);

    if (hasVouchers) {
      vouchers.forEach((v) => {
        doc.setFont('helvetica', 'bold');
        doc.text(`• Code: ${v.code}`, 16, y);
        doc.setFont('helvetica', 'normal');
        doc.text(`Rs ${v.face_value} OFF (In-store purchase Rs 3,000+)`, 56, y);
        y += 4.5;
      });
    }

    if (hasGift) {
      const statusText = gift.status === 'COLLECTED' ? 'Claimed' : 'To be collected';
      doc.text(`• Event Gift: ${gift.description} (${statusText})`, 16, y);
      y += 5;
    }

    y += 6;
  }

  // Footer / Thank You
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Thank you for celebrating fashion with FEVER!', pageWidth / 2, y + 6, { align: 'center' });
  doc.text('For returns or exchanges, please produce this bill within 7 days at our store.', pageWidth / 2, y + 10, { align: 'center' });

  return doc;
}

/**
 * Downloads the generated PDF directly to the user's phone or laptop
 */
export function downloadInvoicePdf(options: GenerateInvoicePdfOptions): void {
  const doc = generateInvoicePdf(options);
  doc.save(`Invoice_${options.invoice.invoice_number}.pdf`);
}

/**
 * Returns PDF as a Blob for Web Share API
 */
export function getInvoicePdfBlob(options: GenerateInvoicePdfOptions): Blob {
  const doc = generateInvoicePdf(options);
  return doc.output('blob');
}
