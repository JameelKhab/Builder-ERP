# Supplier, contact and catalogue increment · 29 October 2026

Builder ERP now maintains company contacts, independently reviewed supplier terms and typed material/service catalogue records. These connect to the existing request → quotation → sourcing review → order → receipt chain. Everything remains local. This is an operational subset of the full comparison, not full M05/M06 acceptance or a production migration.

## Clear destinations and tasks

Home → **Contacts & catalogue**, or Company → Shared information → Contacts & catalogue. Three named categories separate Contacts & suppliers, Materials & services, and Categories & units. Search opens the same canonical record; pending supplier reviews also appear in My Work and the Home review count. A contact detail shows current terms before a proposed revision, with an explicit independent review. Histories and example instructions are progressive detail. These choices retain Builder’s original visual direction and do not reproduce Odoo’s icon grid or nested application tabs.

The company selector is authoritative. One party may be both a customer and supplier and be linked to several companies; company contact details and commercial terms remain separate. Shared identity can change only with master authority in every linked company. Company-wide maintenance and terms review require separate capabilities; project-only grants do not become company-wide write authority. An unpriced site user sees contact identity but not commercial terms, proposals or commercial history. The relevant presets are explicitly versioned; no purchase or budget approval limit is added.

## Operational controls

- Create, revise, archive and restore company contact relationships. No hard deletion. Existing accessible party identities can be explicitly linked to another authorised company; inaccessible company terms are never copied or listed.
- Propose permitted/preferred AED/EUR/USD currencies, invoice-relative payment days, effective dates and evidence. Separate immutable approval/return decisions enforce independent review, live authority and stale-version checks. A new supplier is unusable until approved. A pending replacement leaves current approved terms in use. A purchasing block takes effect immediately; reviewed terms are required to lift it.
- Maintain material/service items, product categories, descriptions and active status. Code/type/base unit/quantity precision are fixed at creation. Services cannot enter material stock. Existing sample products retain their earlier six-decimal quantity policy; new items follow the selected unit’s explicit policy.
- Define product-specific packs with exact base quantity and a pack reference; retire/restore without changing factors. Names never imply a conversion. Supplier item codes are entered explicitly per vendor quotation; a generic pack reference never becomes a vendor code. This is not a full dimensional conversion or quantity-tier supplier-pricelist engine.
- Quotations default to approved supplier preference and allow only that company’s permitted currencies. Currency/vendor/unit changes clear price inputs. Every quotation freezes pack price/conversion, supplier identity/address, terms and product identity/unit. Requests, allocations and stock use base quantities. Integer ratio arithmetic rounds currency amounts directly, without first rounding a derived base-unit price.
- Sourcing, approval and order creation recheck supplier availability, effective/current terms, legal identity/address and product availability. Changed terms/identity require fresh quotation and review. Issued orders and receipts retain their snapshots after masters change. Existing orders remain deliverable when a supplier is subsequently blocked.
- Schema 6 is additive. Existing transaction/history rows are not rewritten; baseline master snapshots explicitly record values available at upgrade. Existing supplier payment days are **unknown**, not invented as zero or a prior approval. New approved terms require explicit payment days. Historical source data before this local baseline is still unavailable.

## Examples and verification

The additive `masters-v1` example pack creates one shared fictional Meridian Materials identity with EUR/30-day terms for JAKH Contracting LLC and USD/45-day terms for JAKH International Ltd. Each company has an independent 60-day proposal awaiting review, a pallet of 100 blocks, and a service item. It does not alter old financial openings or existing quotes. Every supplied project uses its company’s canonical catalogue.

Browser QA additionally saved **EX-QA-TIE · Example · Formwork tie rod** and **Bundle of 10 rods** in the persistent local workspace. A fractional 0.5-unit pack was rejected with visible feedback before the valid pack was saved. The item survived server restart. The browser then submitted **MR-317C3DA4** for ten rods and saved **SQ-9EA1D936**, quoting one bundle at EUR 25 with explicit vendor item code EX-MER-TIE-10 and a clearly fictional EUR/AED rate of 4. It remains with procurement, without sourcing approval or an order. No real account credentials, access grants, supplier messages, payments, source transactions, GitHub pushes or deployments were created by this work.

Final full regression: **109 tests passed**, frontend build passed and diff whitespace validation passed.

Automated coverage includes independent activation; company/project scope; unpriced projection; shared identity and private company terms; effective/stale terms; block/reapproval; product/service/precision constraints; pack immutability/retirement; exact partial pack awards/receipts; historical name/address/unit preservation; current identity/address rechecks; additive examples; and HTTP session/preview/search/My Work connections. The HTTP journey creates a supplier and product, reviews terms, sources and independently approves eight units from three-unit bundles at EUR 10, issues an AED 106.68 commitment and verifies unchanged cash. Test and browser evidence: `../validation/masters/`.

Backup `.work/data/builder-before-masters-20261029.sqlite` preserves pre-upgrade data. Recovery drill `.work/data/builder-masters-recovery-check.sqlite` matched all 46 current tables; all prior rows/columns in 36 tables remained unchanged, with additive records allowed. Integrity and foreign-key checks passed. The persistent workspace still has zero configured individual identities; the user chooses real credentials through setup.

## Scope retained

F026/F044/F045/F084/F085/F088–F090/F108/F116/F117/F125/F126/F130/F131/F146/F147/F222 have relevant master foundations or partial operational work; no full parity is certified. M05/M06/M12/M13/M32 remain partial. See `contracts/masters-v1.md` and the unchanged full 267-function coverage register.

Outstanding: full supplier quantity tiers/pricelists, sales/customer pricing and credit terms, multiple contacts/addresses, tags/industry/country/state/city configuration, product variants/barcodes, supplier qualification and attachments, tax/Incoterms, reviewed bank instructions, service-entry/bill matching, accounting/payment/cash, all other retained ERP domains, governed AI, real source import/reconciliation and representative-user acceptance. These remain build work; the local master increment does not replace them with examples.
