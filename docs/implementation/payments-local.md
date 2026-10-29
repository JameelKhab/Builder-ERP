# Supplier payments, refunds and bank evidence — local implementation

29 October 2026. Original Builder ERP code, schema 10. Connected supplier settlement subset; the full 267-function ERP and source migration remain in progress.

## One clear route

Home / Company / Project → **Payments & cash flow**. The payment register filters by project and state, then opens one record. Cash findings, bank statements and bank setup are available according to permissions. My Work identifies the user's drafts, independent reviews and transactions they may record. Search, examples, bill and journal links retain the same canonical record. Earlier commercial/cash examples remain explicitly read-only.

Preparation selects posted bill balances, one company/supplier/invoice currency and an accounting bank. One payment can settle several bills and projects; a batch spanning projects requires company-wide authority. Company- and project-level reports use the authorised allocations. Project readers cannot open or search a broader batch's full details.

**Draft → independent approval → recorded offline transaction → independent bank match.** Approval alone neither reduces AP nor creates cash. The user records a transaction already performed elsewhere with a bank reference and evidence explanation; Builder ERP sends no money. Current roles, separate payment limits, account/source revisions, approved reservations and open periods are checked again atomically. An approver cannot prepare or record the same payment. Existing users receive zero payment authority. Treasury clerks have no general-ledger or AP preparation rights; bank reconcilers cannot prepare or approve payments; auditors can read bank evidence without mutating it.

## Exact balances and corrections

Partial allocations consume transaction and carrying balances proportionately, exhausting original residual cents on the final allocation. Functional-currency journals retain the original bank/invoice currency and conversion evidence in their source payment. AP carrying value, actual bank value and settlement FX remain separate. Different bank and bill currencies are supported with explicit bank amount/rate evidence. No second operational material cost is created.

Credits after payment create visible negative supplier balances. Supplier refunds settle those balances. Posted settlements are immutable; a full independently approved reversal offsets the exact original accounts and values. Generic journals cannot bypass the payment subledger. Reversed originals and correcting inflows can each match their respective bank evidence where both occurred. Previously matched originals require independent unmatching before reversal. Original documents, journals, allocation rows and decisions remain retained.

Immutable statement sections reconcile opening + inflows − outflows to closing. Date overlaps, duplicate actual references, stale versions, wrong currency/bank/direction and inexact matching fail. One row may match several recorded transactions. Matching/unmatching never creates another cash posting. The reconciler must differ from the transaction recorder. Another reconciler may void an erroneous statement after removing matches; retained original evidence and a new statement reference preserve the correction history.

## Findings and examples

Every cash report starts with complete-population findings, scope/cutoff and explicit currency. Recorded out/in/net, current dated bank clearance and approved-but-unrecorded plans remain distinct. CSV includes the findings, limitations, all allocation sources and planned payments. Supplier-balance reports now include settlements, refunds and reversals and reconcile to the linked AP control. Dated financial facts use accounting dates; clearance is the currently active match with a statement date through cutoff, not a reconstructed historical reconciliation state.

The additive `payments-v1` pack contains **24 payments across three projects/two companies**: partial matched/awaiting-match payments, returned original plus reversal, approved plan, draft, fully paid bill and post-return supplier refund. It also adds two statements with both matched and unmatched rows, six AP documents and three separate procurement chains for refund examples. Existing work/history/credentials are preserved. New fictional POs add AED 200 / USD 40 commitments; the payment and AP postings do not add operational incurred cost or alter illustrative cash openings.

Sample JAKH cash findings: AED 920.40 out, 106.60 in, 813.80 net; 520.00 currently bank matched, 293.80 net awaiting match. Harbour contributes AED 657.30 net and Garden AED 156.50. Creek is separately USD 156.50 net. Original bill open balances after partial settlement are EUR/AED/USD 101.80 by project; the separate paid/credited/refunded bill closes to zero. Every project AP control difference is zero.

## Verification and remaining scope

**162 tests pass**, including individual-identity HTTP preparation → approval → recording → statement match, exact residuals/FX/refunds/reversals, multi-bill/project isolation, current grants/limits, statement correction, periods, source protection, reports/CSV and additive examples. Frontend build passes. Browser saved/submitted a disposable EUR 12.60 / AED 52.92 draft; only independent review was offered next. No browser posting/payment/permission change occurred. Findings/project/company/CSV/mobile and bank evidence/forms were checked. See `../validation/payments/verification.md`.

All 62 prior tables retain prior rows/columns, except journal sequences advance exactly with added typed sample journals. A reopened backup matches all 70 schema-10 tables including blobs; integrity/FK checks pass. Persistent workspace has zero configured credentials. Files, database and commits stay on this Mac.

This is not complete company cash flow, a bank integration or production accounting acceptance. Customer invoices/receipts, advances/retention/subcontract certificates, payment runs/beneficiary verification, statement file import, bank fees/transfers/openings, full cash classifications/forecasts, foreign-bank remeasurement/period revaluation, broad currency policies, invoice/statement attachment retention, and production source import/reconciliation remain open. Detailed source parity and representative-user acceptance remain unverified. IAS 21 ordinary settlement treatment informed the arithmetic; no full IFRS or jurisdictional compliance is claimed.
