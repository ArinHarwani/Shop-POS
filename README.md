# TRENDY POS – FEVER Trendy Collection Event Billing System

A high-speed, 3-day pop-up event billing app for **FEVER's Trendy Collection** (Event Dates: **9 to 11 Oct 2026**).
Designed for stall counters: type an item number, bill it in seconds, auto-calculate non-additive rewards, and share invoices and voucher codes on WhatsApp in a single tap without requiring the official WhatsApp Business API.

---

## 🌟 Key Features & Architecture

- **Lightning-Fast Billing (BIL-1 to BIL-8)**:
  - Exact match first, partial search second. Out-of-stock items are strictly blocked.
  - Cart persists locally across browser refreshes and tab closures (`localStorage`).
  - Single atomic database function (`finalize_bill`) with an idempotency key (`client_request_id`) prevents duplicate bills on double-taps.
  - Sequence-generated invoice numbers (`TR-0001`, `TR-0002`).
  - Historical integrity: Snapshot prices and item names are permanently frozen on invoices.
  
- **Dynamic Tier Reward Engine (RWD-1 to RWD-3)**:
  - Exactly 4 tiers configured in `offer_tiers`:
    - Tier 1: Threshold Rs 499 -> 0 vouchers, 1 Small gift
    - Tier 2: Threshold Rs 999 -> 1 voucher of Rs 250, 0 gifts (min purchase Rs 3,000, 30 valid days)
    - Tier 3: Threshold Rs 1,499 -> 1 voucher of Rs 350, 1 Small gift (min purchase Rs 3,000, 30 valid days)
    - Tier 4: Threshold Rs 1,999 -> 1 voucher of Rs 500, 0 gifts (min purchase Rs 3,000, 30 valid days)
  - Single highest met threshold (>=) wins (strictly non-additive).
  - Evaluates the amount actually payable for merchandise (merchandise total after manual discounts and after any voucher deduction).
  - Cryptographically unambiguous random voucher codes: `TRD-XXXX-XXXX` (excludes confusing characters `0`, `O`, `1`, `I`, `L`).
  - Standard printed terms on all vouchers and messages: *"Valid till <date>. Use on an in-store purchase of Rs 3,000 or more. One voucher per bill. Not exchangeable for cash."*
  - Expiry is calculated in Asia/Kolkata timezone: end of day (23:59:59 IST) of (issue date in IST + 30 calendar days).

- **WhatsApp & Share Sheet Integration (SHR-1 to SHR-4)**:
  - **Primary Path (1 Tap)**: `https://wa.me/<number>?text=<encoded_invoice>` prefilled message containing line items, rates, totals, voucher codes, and gift status.
  - **Secondary Path**: Web Share API with client-generated PDF & voucher PNG images (`navigator.canShare({ files })`), with automatic download fallback.
  - **Fallback Paths**: One-tap Copy Message button and SMS link.
  - **Message Audit Log**: Logs `PREPARED`, `OPENED`, and manual `MARKED_SENT` (strictly never asserts fake "delivered" or "read" claims).

- **Document Generation (DOC-1 & DOC-2)**:
  - **DOC-1**: Client-side branded A5 receipt PDF (`jsPDF`) with full breakdown and reward summary.
  - **DOC-2**: High-resolution HTML5 Canvas PNG voucher graphics for digital sharing.

- **Inventory, Rapid-Add & Barcode OCR (INV-1 to INV-7)**:
  - Continuous focus Rapid-Add form (resets to item number after save).
  - Duplicate detection offers to increment stock on hand or open existing records.
  - Bulk CSV import with row-by-row validation preview and downloadable sample template.
  - **Tesseract.js OCR Assist**: Dynamically loaded on the OCR screen only to keep bundle size small. Reads printed barcode digits into the Item Number field for confirmation. Manual entry is always active.
  - Append-only `stock_movements` audit trail.

- **In-Store Voucher Verification & Redemption**:
  - Standalone staff portal (`/vouchers`) for post-event redemptions at the Jodhpur store.
  - Validates minimum purchase (`Rs 3,000+`), expiry, and single-use status. Refuses duplicate redemptions.

- **Reports, Daily CSV Backups & Dashboard (RPT-1 to RPT-3)**:
  - Real-time today's sales, bill count, garments sold, average bill, and payment split (`Cash`, `UPI`, `Card`, `Other`).
  - One-tap "Mark Gift Collected" for pending gifts.
  - **Daily CSV Export**: Exports products, invoices, lines, customers, vouchers, gifts, and stock movements off the device in standard CSV format.

- **Role-Based Permissions (SYS-1)**:
  - `owner`: Discounts, stock adjustments, offer edits, and bill voiding.
  - `staff`: High-speed billing, voucher lookup, and gift hand-over.

---

## ⚙️ Open Decisions & Assumptions

| # | PRD Decision | Confirmed Setting | Implementation Note |
|---|---|---|---|
| 1 | Item number uniqueness | Unique per garment style/tag | Text column `item_number` preserves leading zeros (e.g. `004812`). Quantity tracked via `quantity_on_hand`. |
| 2 | Voucher terms | Minimum purchase Rs 3,000 in-store, 30 days expiry | Dynamic per tier: Tier 2 (Rs 250 off), Tier 3 (Rs 350 off), Tier 4 (Rs 500 off). Redeemable at store only. At most 1 voucher per bill. |
| 3 | Where and when redeemed | Store only | Standalone redemption screen at `/vouchers` for store staff. |
| 4 | Gift item description | Small gift | Tracked as "Small gift" with `COLLECTED` or `PENDING_COLLECTION` states. |
| 5 | Reward threshold basis | Amount actually paid for merchandise | Subtotal minus discount minus voucher deduction. |
| 6 | Cancellations & returns | Partial exchanges via credit note; full cancellation restores stock | Full void via `cancel_invoice` restores stock, voids unredeemed vouchers, and prevents voiding if voucher already redeemed unless owner overrides with reason. |
| 7 | Counter hardware | 1 phone per billing counter; laptop as backup | Optimized for mobile screens, >=44px touch targets, numeric keypads (`inputMode="numeric"`), and laptop Enter-to-add shortcuts. |
| 8 | Invoice details | FEVER & Trendy Collection branding only | No GSTIN shown. Clean fashion receipt aesthetic with Instagram handle. |
| 9 | Offline billing | Online-only finalize with persistent cart | If offline, Finalize button is cleanly disabled with an informative banner. Cart survives reloads. |
| 10| Event dates & volume | 9 to 11 Oct 2026; ~50 bills/day | Sequence starts at `TR-0001`. |

---

## 🛠️ Local Setup & Running Locally

### 1. Prerequisites
- **Node.js**: v18.0.0 or later (tested on v24.12.0)
- **npm**: v9.0.0 or later

### 2. Installation
```bash
# Clone or navigate to the directory
cd "Shop POS"

# Install dependencies
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your Supabase project URL and anon public key when connecting to Supabase:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_STORE_NAME="FEVER - Trendy Collection"
```
*(Note: If Supabase credentials are not supplied, the app automatically runs in local standalone mode using persistent browser storage so you can immediately test all features without setup friction).*

### 4. Running the Dev Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Running the Production Build
```bash
npm run build
npm start
```

---

## 🧪 Automated Test Suite

The test suite covers all acceptance tests, edge cases, and reward threshold boundaries specified in the updated PRD:
- Rs 498 (0 vouchers, 0 gifts)
- Tier 1: Rs 499 (0 vouchers, 1 Small gift)
- Rs 998 (0 vouchers, 1 Small gift)
- Tier 2: Rs 999 (1 voucher of Rs 250, 0 gifts)
- Rs 1,498 (1 voucher of Rs 250, 0 gifts)
- Tier 3: Rs 1,499 (1 voucher of Rs 350, 1 Small gift)
- Tier 4: Rs 1,999 (1 voucher of Rs 500, 0 gifts)
- Section F mandatory tests:
  - Redeem on a bill of Rs 2,999 -> Refused, "Add Rs 1 more"
  - Redeem on a bill of Rs 3,000 -> Accepted; Rs 250 / 350 / 500 deducted per voucher
  - Bill Rs 3,000 with a Rs 10 manual discount (total 2,990) -> Refused
  - Redeem on issue date + 30 days at 23:59 IST -> Accepted
  - Redeem at 00:01 IST next day -> Refused as expired
  - Voucher issued at 23:50 IST and checked at 00:10 IST next day -> Expiry computed from IST issue date
  - Two vouchers on one bill -> Refused
  - Same voucher redeemed twice -> Exactly one succeeds
  - Voucher from a cancelled bill -> Refused as cancelled
  - Vouchers tab shows expired voucher -> Red "Expired" with date, no "Use" button
  - Bill Rs 3,600 using a Rs 500 voucher (A = 3,100) -> Redeems, new offer computed on 3,100 (Tier 4: Rs 500 voucher)
- Double-tap Finalize idempotency
- Out-of-stock cart additions
- Single-use voucher redemption and double-redemption blocking
- Owner-only bill cancellation & stock restoration
- Phone normalization (E.164, default +91 for 10 digits)
- WhatsApp message formatting and character limits

Run the test suite:
```bash
npm test
```

Run TypeScript type check:
```bash
npm run type-check
```

---

## 🗄️ Supabase Postgres & Database Migrations

The complete SQL migration is located in `supabase/migrations/20261009000001_trendy_pos_schema.sql`.

### Applying Migrations via Supabase CLI
```bash
# Link project
npx supabase link --project-ref your-project-id

# Push migrations
npx supabase db push
```
Alternatively, open the **Supabase Dashboard -> SQL Editor**, paste the contents of `20261009000001_trendy_pos_schema.sql`, and execute.

### Row Level Security (RLS) & Security Definer Functions
- **RLS is enabled on every table** (`products`, `invoices`, `invoice_items`, `customers`, `offer_tiers`, `vouchers`, `gifts`, `stock_movements`, `message_logs`, `profiles`).
- **Atomic Operations**: Sensitive writes execute via Postgres `SECURITY DEFINER` functions:
  - `finalize_bill(payload JSONB)`: Row-locks products `FOR UPDATE`, checks stock, freezes snapshots, sequences invoice numbers, generates unambiguous random voucher codes, and saves audit movements in a single transaction.
  - `cancel_invoice(p_invoice_id, p_reason, p_override_redeemed)`: Restores product inventory, voids unredeemed vouchers/gifts, and logs `CANCEL` movements.
  - `redeem_voucher(p_code, p_invoice_id)`: Enforces single-use redemption and checks expiry.
  - `adjust_stock(p_product_id, p_delta, p_reason, p_note)`: Owner-only inventory adjustments.

---

## 🚀 Vercel Deployment

1. Push this repository to GitHub or GitLab.
2. Go to [vercel.com](https://vercel.com) and click **Add New -> Project**.
3. Import the repository.
4. In **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_STORE_NAME`
5. Click **Deploy**.

---

## 📱 Operational Limits & Best Practices

1. **WhatsApp Sharing**:
   - Primary `wa.me` text link opens customer chats in 1 tap without requiring third-party APIs.
   - Stall staff should use the free **WhatsApp Business App** on their counter phone so customer interactions stay separate from personal chats.
   - Do not use customer numbers for unsolicited bulk broadcasts.
2. **Tag OCR Assist**:
   - OCR reads printed numbers only. Keep tags steady under good stall lighting.
   - Manual entry is always active and never blocked by OCR.
3. **Daily CSV Export**:
   - At the close of each event day, tap **Export All Data (CSV)** from the Reports page to save backups off the device.
