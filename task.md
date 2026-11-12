# ReelMitra Implementation Tasks

## Completed Foundation
- [x] PostgreSQL schema setup & migration scripts (`db/schema.sql`, `db/migrate.js`, `db/seed.js`)
- [x] Authentication APIs (`/api/v1/auth/*` — 10 endpoints)
- [x] Common User Profile APIs (`/api/v1/users/me/*` — 7 endpoints)
- [x] Categories & Public Editor Discovery APIs (`/api/v1/categories/*`, `/api/v1/editors/*` — 7 endpoints)
- [x] Editor Profile, Categories & Portfolio CRUD APIs (`/api/v1/editor/*` — 13 core endpoints)
- [x] PostgreSQL Query Viewer + Multi-DB Switcher + Groq/Ollama AI Assistant (`public/`, `index.js`)

---

## Phase 1: Dependencies, Environment & Database Schema (Razorpay PG + RazorpayX)
- [x] Install required packages: `razorpay`, `cloudinary`, `multer`
- [x] Configure `.env` variables for PG, Cloudinary & RazorpayX (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAYX_ACCOUNT_NUMBER`, `RAZORPAYX_WEBHOOK_SECRET`, `RAZORPAYX_CONTACT_TYPE`, `RAZORPAYX_AUTO_VALIDATE=false`, `MIN_WITHDRAWAL_AMOUNT=100`, `CLOUDINARY_*`)
- [x] Update `db/schema.sql` cleanly & remove legacy Razorpay Route schema:
  - [x] Drop `transfers` table and drop `editor_profiles.razorpay_linked_account_id`
  - [x] `orders`: save `amount`, `commission_percent` (`20.00`), `platform_fee`, `editor_amount`
  - [x] `payments`: store `razorpay_order_id`, `razorpay_payment_id`, `payment_method`, `paid_at`, `created` / `captured` / `failed` / `refunded` statuses with unique partial indexes
  - [x] `editor_earnings`: store `order_id`, `editor_id`, `gross_amount`, `platform_fee`, `editor_amount`, `status` (`pending` / `available` / `cancelled`)
  - [x] `editor_payout_accounts`: store `editor_id`, `razorpay_contact_id`, `razorpay_fund_account_id`, `razorpay_validation_id`, `account_type`, `account_status` (`pending_verification` / `validating` / `verified` / `failed` / `inactive`), `account_label`, `registered_name`, `failure_reason`
  - [x] `payouts`: store `editor_id`, `payout_account_id`, `amount`, `currency`, `mode`, `razorpay_payout_id`, `utr`, `status` (`queued` / `pending` / `processing` / `processed` / `failed` / `reversed` / `rejected`), `failure_reason`, `created_at`, `completed_at`
- [x] Run `node db/migrate.js` and verify all 16 tables on Render PostgreSQL

---

## Phase 2: Cloudinary Media Storage (Videos, Images, User Data)
- [x] Create `config/cloudinary.js` and update `models/mediaModel.js`, `controllers/uploadController.js`, `routes/uploadRoutes.js` (`/api/v1/uploads/*`)

---

## Phase 3: Orders & Pre-Saved Commission Flow
- [x] Create/update `models/orderModel.js`, `controllers/orderController.js`, `routes/orderRoutes.js` (`/api/v1/orders/*`)
- [x] Pre-save `20%` `platform_fee` and `80%` `editor_amount` at order creation; unlock `editor_earnings` from `pending` -> `available` on order completion

---

## Phase 4: Razorpay Payment Gateway + RazorpayX Services & Webhooks
- [x] Configure PG SDK + RazorpayX REST client helpers in `config/razorpay.js` (`POST /v1/contacts`, `/v1/fund_accounts`, `/v1/fund_accounts/validations`, `/v1/payouts` with `X-Payout-Idempotency`, `GET /v1/payouts/:id`)
- [x] Update `models/paymentModel.js` & `controllers/paymentController.js` (`/api/v1/payments/*`)
- [x] Remove Route controllers/models/routes (`transferModel.js`, `transferController.js`, `transferRoutes.js`) and remove `razorpay_linked_account_id` from editor APIs
- [x] Add RazorpayX webhook handling (`payout.*`, `fund_account.validation.*`) alongside PG webhooks (`payment.captured`, `payment.failed`, `refund.processed`) in `/api/v1/payments/webhook` and `/api/v1/payouts/webhook`

---

## Phase 5: Editor Wallet Ledger, Payout Account Validation & Withdrawals
- [x] Update `models/earningModel.js` (ledger summary: `total_earned`, `pending_amount`, `available_balance`, `reserved_amount`, `withdrawn_amount`, `minimum_withdrawal_amount`)
- [x] Create `models/payoutAccountModel.js` (`pending_verification` persistence, duplicate-safe `beginValidation`, `markValidationUnavailable` graceful fallback, strict `verified` promotion only on `completed` + `active`)
- [x] Create `models/payoutModel.js` (`FOR UPDATE` wallet lock, strict `verified` account & `MIN_WITHDRAWAL_AMOUNT` checks, zero negative balances, concurrent double-withdrawal protection, release reserved funds on definitive failures/reversals)
- [x] Create `controllers/payoutController.js`, `routes/payoutRoutes.js` (`/api/v1/payouts/*`), and mount editor wallet & payout account routes in `routes/editorRoutes.js`

---

## Phase 6: Client–Editor Messaging (Chat) & Reviews
- [x] Implement `/api/v1/conversations/*` and `POST /api/v1/orders/:id/review`

---

## Phase 7: Verification & Documentation
- [x] Run regression suite (`verify_all_apis.js`: 43 passed, 0 failed) & Razorpay PG + RazorpayX E2E suite (`verify_new_features.js`: 34 passed, 0 failed)
- [x] Update `API_DOCUMENTATION.md`, `remaining.md`, and `task.md`
