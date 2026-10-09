import { Voucher } from '@/types';
import { formatDisplayDate } from './whatsapp';

/**
 * Renders a voucher onto an offscreen canvas and converts it to a PNG Blob or Data URL (DOC-2).
 * Styled with an ultra-premium luxury gift voucher aesthetic (gold accents, FEVER crimson branding, crisp typography).
 */
export async function renderVoucherCanvas(voucher: Voucher): Promise<Blob> {
  const width = 800;
  const height = 400;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Background Gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#0f172a');
  gradient.addColorStop(0.5, '#1e1b4b');
  gradient.addColorStop(1, '#090d16');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Decorative Border
  ctx.strokeStyle = '#f59e0b'; // Gold border
  ctx.lineWidth = 4;
  ctx.strokeRect(16, 16, width - 32, height - 32);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(24, 24, width - 48, height - 48);

  // Left ribbon accent
  ctx.fillStyle = '#e11d48';
  ctx.fillRect(24, 24, 12, height - 48);

  // Header - Brand
  ctx.fillStyle = '#f43f5e';
  ctx.font = 'bold 30px "Outfit", sans-serif';
  ctx.fillText('FEVER', 56, 70);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 13px "Inter", sans-serif';
  ctx.fillText('TRENDY COLLECTION • EXCLUSIVE REWARD VOUCHER', 56, 92);

  // Value Display
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 54px "Outfit", sans-serif';
  ctx.fillText(`Rs ${voucher.face_value} OFF`, 56, 165);

  // Subtitle / Min purchase
  const minPurchaseText = voucher.min_purchase
    ? `Valid on in-store shopping on purchase of Rs ${voucher.min_purchase} or more`
    : 'Valid on your next in-store shopping visit';
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '15px "Inter", sans-serif';
  ctx.fillText(minPurchaseText, 56, 200);

  // Voucher Code Box
  ctx.fillStyle = '#020617';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  const boxX = 56;
  const boxY = 230;
  const boxW = 440;
  const boxH = 64;
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 28px monospace';
  ctx.fillText(voucher.code, boxX + 24, boxY + 42);

  // Terms & Expiry
  const expiryDate = voucher.expires_at ? formatDisplayDate(voucher.expires_at) : 'Valid at Jodhpur Store';
  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px "Inter", sans-serif';
  ctx.fillText(`Expiry: ${expiryDate}`, 56, 330);
  ctx.fillText('Terms: Redeemable once at store only. Not redeemable on event purchase.', 56, 352);

  // Right Seal / Stamp
  ctx.save();
  ctx.translate(680, 200);
  ctx.beginPath();
  ctx.arc(0, 0, 70, 0, Math.PI * 2);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, 62, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 12px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('OFFICIAL REWARD', 0, -18);
  ctx.font = 'bold 22px "Outfit", sans-serif';
  ctx.fillText('FEVER', 0, 8);
  ctx.font = '10px "Inter", sans-serif';
  ctx.fillText('VERIFIED CODE', 0, 26);
  ctx.restore();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create blob from voucher canvas'));
    }, 'image/png');
  });
}

/**
 * Downloads the voucher image to the local device
 */
export async function downloadVoucherPng(voucher: Voucher): Promise<void> {
  const blob = await renderVoucherCanvas(voucher);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Voucher_${voucher.code}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
