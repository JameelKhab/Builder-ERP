# Customer receipts and AR settlement — v1

29 October 2026. Original implementation contract for F124/F122/F133/F134/F136 and M23/M24/M32. This advances the complete 267-function scope; advances, refunds/credit notes, retention release and source migration remain separate required work.

## Evidence and sequence

Fresh read-only JAKH contract 3 → cash document 4 distinguishes a customer advance request, its invoice, posted status, payment status and receivable reconciliation. Its 1,000 ceiling is not proof of receipt. Existing invoice 45 likewise distinguishes original gross/retention/recovery from receivable settlement. Source captures are retained under validation/receipts/source. No source acceptance tests, accounting export or code copying occurred. Implement invoice receipts first; advance invoicing/recovery must use their actual settled balance, not a direct invented opening liability.

## Original records and controls

One receipt belongs to one legal company, customer, invoice currency and bank, with one or more explicit invoice/project allocations. Posted certificate invoices supply immutable receivable/account values. One receipt can settle two or more invoices without posting revenue twice. Multiple projects require company-wide preparation/review; project views expose only authorised allocation rows. One-project users can prepare scoped receipts. Bank configuration stays shared with supplier settlement.

Draft → submitted → independently approved → recorded. Approval reserves invoice availability but creates no accounting/cash. Recording describes an actual offline transaction with a bank reference and retained original evidence file; it executes no transfer. The recorder differs from the approver. Separate receipt authority defaults to zero and covers the larger bank functional amount or AR carrying amount. Recheck current author/reviewer rights, exact invoice balances, account/bank identity, version, date, open period and competing reservations at submit/approve/record. Withdraw/return invalidates approval; cancellation retains history.

Partial allocation uses exact remaining transaction/carrying balances; the final allocation exhausts residual cents. Functional journals debit bank, credit AR and post the difference to configured FX gain/loss. Bank amount/currency/rate and original invoice carrying amounts remain separate; each project allocation balances independently. No new revenue, cost, retention release or invoice mutation occurs. A shared bank reference cannot be reused across supplier or customer cash. Retry of recording returns the existing result only for the same authorised recorder and evidence/reference.

Recorded receipts remain immutable. Full linked reversal retains original amounts/accounts and restores AR through another independent approval/recording decision, dated no earlier than subsequent settlements. Clear evidence must first be independently unmatched. Reversals do not delete originals, alter invoice recognition or execute a refund. Credit notes, commercial refunds, unallocated money and short-payment write-offs require their own later typed paths.

## Bank evidence and reporting

Use the existing immutable statement register. One row can match supplier and/or customer transactions of the same bank/direction, exactly consuming its amount. Matching/unmatching requires a different actor from every recorder, current company-wide reconciliation rights and live versions. A transaction can have one active match; statement voiding checks both subledgers. Matching creates no cash twice. Reconciliation history is retained; cutoff clearance uses statement date and current active matches, not a reconstructed historical decision state.

Receipt reports calculate the complete authorised population through the cutoff. Findings separate approved plans, recorded money, bank-cleared evidence, FX and AR open/overdue balances. Currency groups are explicit. AR control reconciliation follows posted invoice and receipt/reversal journals through the same cutoff, including each authorised project allocation. Bank movements are not an opening balance or complete company cash-flow statement. CSV reproduces scope, definitions, findings and source rows. One canonical receipts destination and invoice/receipt/ledger links retain context; next action precedes expandable allocations/evidence/history.

## Acceptance

Test partial/final cents, one receipt/two invoices, multi-project privacy, foreign bank/invoice currencies and FX, same-currency automatic rate 1, independent zero-default approval/recording, live access/account changes, closed periods, reservations/races, duplicate references, evidence retention, idempotent recording, reversals/cutoffs, mixed bank matching/unmatching/voids, AR control reconciliation, filtered CSV and additive examples/recovery. Browse edit/submit flows using disposable identities and inspect desktop/narrow screens. Meaningful examples in every supplied company/project. No source-parity or full ERP readiness claim from this increment.
