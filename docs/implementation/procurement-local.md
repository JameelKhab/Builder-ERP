# Connected procurement — local implementation

Builder now has a typed request-to-material-use workflow alongside the earlier local examples. It remains a subset of the full comparison; coverage and remaining work for every source destination are tracked in `coverage.json` and `coverage.md`.

## User route and examples

Home → Buying → Purchase requests or Orders & deliveries. Company → Buying opens the same authorised records across projects. My Work includes sourcing reviews. Search finds new request/order IDs; cost-report supporting items link to their purchase order when the viewer has purchasing/material access.

A site request records several products, explicit units, quantities, structured work packages, locations, specifications and required date. A vendor and price are unnecessary. Procurement records product-specific supplier quotes and allocates the quantities. Currency is derived from the vendor; FX date/source and original/company amounts are retained. An independent reviewer approves within their current scope and amount limit. The requester and sourcing author cannot approve their own plan.

Creating local orders splits the plan by supplier and currency and converts its sourcing reservation into commitments exactly once. Nothing is sent to a supplier. Receipts record accepted and rejected quantities separately. Available accepted stock can be returned or consumed, with exact value allocation and a movement ledger. Returning accepted stock reopens supply; consuming it records operational incurred cost. It does not pay a supplier or post an accounting journal.

Every supplied project contains three additional material requests: an unpriced two-line draft, a sourcing review and an ordered case. There are four example orders across the three projects, each with a partial receipt, rejection, return and consumption. They are fictional records exercised through the same services, installed atomically once. They add separately identified local transaction facts to reports; existing opening snapshots and user work are preserved. They do not represent imported JAKH data.

## Verification

**65 automated tests passed** and the frontend build passed. The automated suite covers exact arithmetic, multi-line demand, source allocation, vendor currencies, role and scope checks, approval independence/limits, revisions, expired quotes, unreleased/exhausted allowance, reservation conversion, partial/rejected deliveries, retry commands, stock conservation, residual-cent allocation, cost/cash separation, append-only evidence, direct API redaction, read-only preview, additive examples and nested transaction rollback.

Browser verification created `MR-839E0650` with 25 fictional blocks, saved and reopened it after server restart, submitted it, recorded EUR 10/unit at AED 4/EUR and sent the AED 1,000 plan for independent review. Ahmed's self-approval is unavailable. The test record remains for inspection. The engineer preview showed order/delivery quantities without prices, financial totals or write buttons. No access grants were changed. Checked 1440px and 390px layouts; mobile tables become labelled records. Fixed a browser date-input event issue and a mobile first-cell width issue during verification. Evidence is under `docs/validation/procurement/`.

## Explicit remaining scope

This does not complete D07–D09 or certify source equivalence. Open procurement work includes outbound RFQs, agreements/call-offs, supplier/catalogue/UOM administration, requisition amendment and partial-demand sourcing, taxes/freight/discounts, payment terms, order amendment/cancellation/closure, receipt correction, lot/serial/warehouse/transfer/count/waste workflows, returns to stores, credit notes, bill matching, accounting/payment/cash integration, source attachments/import and full reporting. Receipt valuation rounds each delivery independently; resulting differences from the order remain unapplied until a defined reconciliation policy is implemented.

WBS references and sample released allowances are foundations. Full approved budget/revision/forecast administration remains open. The runtime still uses a server-selected fictional identity with read-only role preview; it is not yet a multi-user production system. The wider ERP and real migration remain active work.
