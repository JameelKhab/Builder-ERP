# Parties, supplier terms and catalogue · original contract v1

Scope: F084/F085/F088–F090/F108/F116/F117/F222 and related customer/product/configuration destinations; M05/M06/M12/M13/M32. This is a connected operational subset; all 267 functions remain tracked and parity unverified.

## Evidence and decisions

Read-only JAKH review on 29 October 2026: Contacts → Arabian Steel Rebar Trading (Demo), Sales & Purchase; Purchasing → Products → Concrete blocks 200 mm (100 pcs), General Information and Purchase. Source captures in `../../validation/masters/`. Contact identity/address, company, sales/purchase terms and supplier currency are visible. Product type, purchase/sale flags, unit, category, company, supplier quantity/unit/price/lead time and received-quantity billing policy are visible. The product name mentions a pack but the source base unit says Units: do not infer a conversion from a name. These are UI observations, not tested source enforcement. No source edits or Odoo code were used.

Original Builder decisions: one stable party identity may be linked to several companies; roles, contact/address and commercial terms stay inside each legal company. A person requires company-wide master authority to maintain company masters; a project-only grant never becomes company-wide authority. Shared identity can change only when the editor can maintain every linked company. Linking uses an already authorised party, not an unrestricted party directory. Customer and supplier roles can coexist without duplicate identity. No hard deletion; archive and immutable document snapshots preserve history.

## Entities and transitions

Party: stable ID, legal name, version. Company relationship: party/company/vendor IDs, customer/supplier/subcontractor roles, business contact/address, reference, active, blocked, current terms ID, version. New suppliers cannot be used until reviewed terms exist. An immediate purchasing block prevents new commitments; lifting it requires independent terms approval.

Supplier terms: immutable proposal, preferred and permitted currencies, payment days after invoice, effective start/end, reason, author, base relationship version, creation date. A separate immutable approve/return decision records reviewer/reason/time. No self approval. Approval rechecks company-wide reviewer authority and the current relationship version, then installs the terms and increments the relationship version atomically. Existing active terms continue while a replacement is pending. No overlapping implicit schedule: future terms cannot activate before their effective date. Country never determines currency. Supported currencies remain AED/USD/EUR with two decimal minor units.

Products: company, stable code, name, material/service type, base unit and precision, category, description, active/version. Code/type/base unit/precision are immutable after creation. Services cannot enter material stock. Categories rename/archive without changing product identity. Product-specific packs have an explicit base quantity, stable ID, name and a pack reference; factors never change, old packs may be retired. Base units are a dimensioned reference list; incompatible global conversions are not inferred.

Quotation snapshots: freeze party name, company address, terms ID/payment days, product code/name/unit/precision and pack conversion. Quotation currency defaults to the approved preferred currency and must be in that company's permitted list. Supplier terms are revalidated at quotation, sourcing, approval and order creation; changed terms require a fresh quotation and reapproval. Issued orders/receipts remain readable and processable after a master is renamed, archived or blocked. Historical monetary facts never change.

Quoted packs convert to exact base quantities. Requests, allocations and stock use the base unit. Award/receipt price uses the frozen pack factor and price, with exact integer ratio arithmetic and explicit currency rounding; a displayed base-unit price is informational. Quantity precision is checked at every boundary. Existing local records get explicit baseline snapshots of the master values available at upgrade; missing original historic identity is not fabricated.

## Verification and remaining scope

Prove company isolation; shared identity visibility; project-only write denial; independent/stale/expired terms decisions; prohibited currencies; current block at every commitment gate; product/service/precision checks; immutable pack factors; exact partial pack pricing; renamed master history; archive and restore; HTTP/preview boundaries; meaningful examples per supplied company; backup/restore row preservation.

Still open after this contract: full supplier quantity-tier/pricelist engine, customer sales terms/pricing, contacts/tags/industry/geographic configuration, multiple address/contact revisions, taxation/Incoterms/credit controls, reviewed bank instructions, accounting matching, migration of real source records and source-policy equivalence. No payment, supplier message, access grant, source modification or deployment is implied by a local record action.
