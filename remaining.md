# ReelMitra — Project Progress & Remaining Work

This document tracks implemented features and remaining external setup items for the ReelMitra backend (Orders, Razorpay Payment Gateway, RazorpayX Payouts, Editor Wallet/Earnings, Cloudinary Storage, and Client–Editor Messaging).

---

## 1. Completed & Verified Work (Ho Gaya Hai)

### A. Database Schema (`db/schema.sql`) — Migrated on Render PostgreSQL (16 Tables)
- Core marketplace tables: `users`, `editor_profiles` (old `razorpay_linked_account_id` removed), `categories`, `editor_categories`, `portfolio_items`.
- Financial & payout separation (5 core financial tables; old `transfers` table removed):
  - `orders`: saves `amount`, `commission_percent` (`20.00`), `platform_fee`, `editor_amount` at creation time.
  - `payments`: stores `razorpay_order_id`, `razorpay_payment_id`, `payment_method`, `paid_at`, and `created` / `captured` / `failed` / `refunded` statuses with unique partial indexes.
  - `editor_earnings`: stores `order_id`, `editor_id`, `gross_amount`, `platform_fee`, `editor_amount`, and `pending` / `available` / `cancelled` statuses.
  - `editor_payout_accounts`: stores `editor_id`, `razorpay_contact_id`, `razorpay_fund_account_id`, `razorpay_validation_id`, `account_type` (`bank_account` | `vpa`), `account_status` (`pending_verification` | `validating` | `verified` | `failed` | `inactive`), `account_label` (masked label — no raw account numbers saved), `registered_name`, and `failure_reason`.
  - `payouts`: stores `editor_id`, `payout_account_id`, `amount`, `currency`, `mode` (`IMPS` | `NEFT` | `RTGS` | `UPI`), `razorpay_payout_id`, `utr`, `status` (`queued` | `pending` | `processing` | `processed` | `failed` | `reversed` | `rejected`), `failure_reason`, `created_at`, and `completed_at`.
- Supporting tables: `order_status_history`, `media_files`, `order_deliverables`, `conversations`, `messages`, `reviews`.

### B. Implemented Backend Modules & APIs
- **Authentication (`/api/v1/auth` — 10 endpoints)** & **User Profile (`/api/v1/users/me` — 7 endpoints)**
- **Categories (`/api/v1/categories` — 3 endpoints)** & **Public Editor Discovery (`/api/v1/editors` — 4 endpoints)**
- **Editor Profile, Portfolio, Earnings & Payout Accounts (`/api/v1/editor`)**:
  - `GET /earnings` & `GET /wallet` (internal ledger summary: `total_earned`, `pending_amount`, `available_balance`, `reserved_amount`, `withdrawn_amount`, `minimum_withdrawal_amount`)
  - `POST /payout-accounts` (creates/reuses RazorpayX Contact + Fund Account; keeps `pending_verification` when `RAZORPAYX_AUTO_VALIDATE=false` or validation API is unavailable)
  - `GET /payout-accounts`
  - `POST /payout-accounts/:id/validate` (manual RazorpayX penny-drop / VPA validation; duplicate prevention; only marks `verified` on confirmed `active` validation)
- **Cloudinary Media Storage (`/api/v1/uploads` — 5 endpoints)**
- **Orders, Deliverables, Revisions & Reviews (`/api/v1/orders` — 9 endpoints)**:
  - Pre-calculates 20% `platform_fee` / 80% `editor_amount`; unlocks `editor_earnings` from `pending` -> `available` on order completion.
- **Razorpay Payment Gateway (`/api/v1/payments` — 3 endpoints)**:
  - `POST /create-order`, `POST /verify`, `POST /webhook` (unified raw-body HMAC verification for PG & RazorpayX webhooks).
- **RazorpayX Payouts (`/api/v1/payouts` — 4 endpoints)**:
  - `POST /webhook` (RazorpayX webhook endpoint verifying `x-razorpay-signature` for `payout.*` & `fund_account.validation.*`)
  - `POST /withdraw` (transactional `FOR UPDATE` balance locking, strict `account_status = 'verified'` & `MIN_WITHDRAWAL_AMOUNT` checks, `X-Payout-Idempotency`, automatic release on definitive failures/reversals)
  - `GET /` (payout history + wallet summary)
  - `POST /:id/sync` (sync payout status & UTR directly from RazorpayX API)
- **Client–Editor Messaging (`/api/v1/conversations` — 4 endpoints)**
- **PostgreSQL Query Viewer + AI Assistant (`public/` & `index.js`)**
- **Documentation**: `API_DOCUMENTATION.md` updated for Payment Gateway + RazorpayX Payouts.

---

## 2. Remaining External Configuration Before Live Razorpay / RazorpayX Calls

1. **Replace Razorpay Payment Gateway & Webhook keys in `.env`**:
   - `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET` (Test or Live mode)
   - `RAZORPAY_WEBHOOK_SECRET` (PG webhook pointing to `/api/v1/payments/webhook`)
2. **Activate & Fund RazorpayX + Set `.env` Values**:
   - Complete RazorpayX KYC/activation and fund the dedicated RazorpayX Current/Lite source account (PG settlements and RazorpayX funds are separate).
   - Replace `RAZORPAYX_ACCOUNT_NUMBER` (your RazorpayX source account number) and `RAZORPAYX_WEBHOOK_SECRET` (RazorpayX webhook pointing to `/api/v1/payouts/webhook`).
   - Allowlist your server's static outbound IP(s) in RazorpayX Dashboard (required in Live mode for Contacts, Fund Accounts, Validations, and Payouts).
   - Enable `RAZORPAYX_AUTO_VALIDATE=true` once Fund Account Validation (RazorpayX Lite / account validation) is activated; adjust `MIN_WITHDRAWAL_AMOUNT` (default `100`) if needed.
3. **Replace Cloudinary placeholder keys in `.env`**:
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
