from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from PIL import Image
import re
import os
from io import BytesIO
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(os.environ.get('JAKH_STUDY_OUTPUT_DIR', str(ROOT / '.work/study/output'))).resolve()
OUT.mkdir(parents=True, exist_ok=True)
EVIDENCE = ROOT / 'docs/study/Source-evidence.zip'
PDF = OUT / 'JAKH-ERP-Read-Only-Study.pdf'
FONT_DIR = Path(os.environ.get('JAKH_STUDY_FONT_DIR', '/usr/share/fonts/truetype/dejavu'))
if not all((FONT_DIR / name).is_file() for name in ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf']):
 raise RuntimeError('Set JAKH_STUDY_FONT_DIR to a directory containing DejaVuSans.ttf and DejaVuSans-Bold.ttf.')
pdfmetrics.registerFont(TTFont('DV', str(FONT_DIR / 'DejaVuSans.ttf')))
pdfmetrics.registerFont(TTFont('DVB', str(FONT_DIR / 'DejaVuSans-Bold.ttf')))
pdfmetrics.registerFontFamily('DV', normal='DV', bold='DVB', italic='DV', boldItalic='DVB')
W, H = 595.276, 841.89
M = 42
CW = W - 2 * M
INK = colors.HexColor('#203238')
TEAL = colors.HexColor('#28675F')
MUTED = colors.HexColor('#52656A')
LIGHT = colors.HexColor('#EDF3F2')
LINE = colors.HexColor('#D7E1DF')
styles = {
 'body': ParagraphStyle('body', fontName='DV', fontSize=10, leading=14.4, textColor=INK, spaceAfter=7),
 'small': ParagraphStyle('small', fontName='DV', fontSize=8.2, leading=11.7, textColor=MUTED),
 'cell': ParagraphStyle('cell', fontName='DV', fontSize=8.2, leading=11.4, textColor=INK),
 'th': ParagraphStyle('th', fontName='DVB', fontSize=8.2, leading=11.4, textColor=colors.white),
 'h2': ParagraphStyle('h2', fontName='DVB', fontSize=13, leading=18, textColor=TEAL),
 'title': ParagraphStyle('title', fontName='DVB', fontSize=23, leading=29, textColor=INK),
}
c = canvas.Canvas(str(PDF), pagesize=(W, H), pageCompression=1)
c.setTitle('JAKH ERP - Revised navigation and construction workflow study')
c.setAuthor('Codex for JAKH')
c.setSubject('Revision 4: multi-company, currencies, report findings and strategic AI alongside the construction map')
page_no = 0
y = 0
page_metrics = []

def safe_markup(text):
 return re.sub(r'&(?![A-Za-z#0-9]+;)', '&amp;', str(text))

def p(text, style='body', gap=7, width=CW, x=M):
 global y
 para = Paragraph(safe_markup(text), styles[style])
 _, height = para.wrap(width, H)
 if y - height < 44:
  raise RuntimeError(f'Page {page_no} overflow: {text[:70]} at {y:.1f}, height {height:.1f}')
 para.drawOn(c, x, y-height)
 y -= height + gap

def begin(title, label):
 global page_no, y
 if page_no:
  finish()
  c.showPage()
 page_no += 1
 c.bookmarkPage(f'page{page_no}')
 c.addOutlineEntry(title, f'page{page_no}', level=0, closed=False)
 c.setFillColor(TEAL)
 c.setFont('DVB', 8.5)
 c.drawString(M, H-32, 'JAKH ERP  /  READ-ONLY STUDY  /  REVISION 4')
 c.setFillColor(MUTED)
 c.setFont('DV', 8)
 c.drawRightString(W-M, H-32, '28 October 2026  |  Dubai')
 y = H-64
 p(title, 'title', 9)
 p(label, 'small', 16)

def finish():
 page_metrics.append({'page':page_no,'remaining_points':round(y-44,1)})
 c.setStrokeColor(LINE)
 c.line(M, 33, W-M, 33)
 c.setFont('DV', 7.5)
 c.setFillColor(MUTED)
 c.drawString(M, 21, 'Discovery findings and proposals - no application redesign or code implementation')
 c.drawRightString(W-M, 21, str(page_no))

def heading(text):
 p(text, 'h2', 6)

def table(headers, rows, widths=None, padding=7):
 global y
 widths = widths or [CW/len(headers)]*len(headers)
 data = [[Paragraph(escape(str(v)),styles['th']) for v in headers]]
 data += [[Paragraph(safe_markup(v), styles['cell']) for v in row] for row in rows]
 t = Table(data, colWidths=widths, hAlign='LEFT')
 t.setStyle(TableStyle([
  ('BACKGROUND',(0,0),(-1,0),TEAL),('VALIGN',(0,0),(-1,-1),'TOP'),
  ('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),
  ('TOPPADDING',(0,0),(-1,-1),padding),('BOTTOMPADDING',(0,0),(-1,-1),padding),
  ('LINEBELOW',(0,0),(-1,0),0.5,TEAL),('LINEBELOW',(0,1),(-1,-1),0.35,LINE),
  ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,LIGHT]),
 ]))
 _,h=t.wrap(CW,H)
 if y-h < 44:
  raise RuntimeError(f'Table overflow page {page_no}: y {y}, height {h}')
 t.drawOn(c,M,y-h)
 y-=h+12

def shot(filename, caption, max_height=350):
 global y
 with ZipFile(EVIDENCE) as evidence:
  image_bytes = BytesIO(evidence.read('jakh-study-evidence/screenshots/' + filename))
 im=Image.open(image_bytes)
 iw,ih=im.size
 # Crop only the blank capture-surface margins in PDF placement. The original
 # screenshot pixels and all visible browser content remain preserved on disk.
 if iw==1107 and ih==769:
  vw,vh=855,594
 else:
  vw,vh=iw,ih
 scale=min(CW/vw,max_height/vh)
 dw,dh=vw*scale,vh*scale
 if y-dh < 70:
  raise RuntimeError(f'Screenshot overflow page {page_no}')
 x=M+(CW-dw)/2
 bottom=y-dh
 c.saveState()
 clip=c.beginPath();clip.rect(x,bottom,dw,dh)
 c.clipPath(clip,stroke=0,fill=0)
 c.drawImage(ImageReader(im),x,bottom-(ih-vh)*scale,width=iw*scale,height=ih*scale)
 c.restoreState()
 c.setStrokeColor(LINE);c.rect(x,bottom,dw,dh,stroke=1,fill=0)
 y=bottom-8
 p(caption,'small',12)

begin('Simpler to use, rich in information', 'Revision 4 - simple construction navigation with company, currency, reporting and AI requirements.')
p('<b>Simple navigation needs a strong information foundation.</b> Keep project work in one continuous workspace, with company-wide specialist queues opening the same records. This revision adds explicit company ownership, vendor currencies, scoped reporting, report findings and carefully placed AI assistance.')
heading('The revised recommendation')
table(['Starting point','Purpose'],[
 ('My Work','What needs my action or decision, what I am waiting for, and where I resume.'),
 ('Tenders','Opportunity, tender, estimate, offer and award, with a clear project handoff.'),
 ('Projects','One workspace: Overview, Plan, Site, Buying, Costs & Contracts, Documents, Handover.'),
 ('Company','Visible directory for Buying, Finance, People, Assets & Fleet, Stores, Contacts & Catalogue, and Reports.'),
],[CW*.25,CW*.75])
p('Keep project, location, work item, owner and next action visible. A case continues through its stages; users do not repeatedly open the same tabs in successive modules. Detailed quantities, money, evidence and history remain available under clear labels.')
heading('What the study covers')
p('Mapped <b>all 42 current primary entries</b> and <b>all twelve requested capabilities</b>; walked twelve findability scenarios on paper; examined four difficult cross-team journeys; specified record behaviour, scope, search, permissions and validation gates. No staff usability test or executable prototype was used.')
heading('Read this first')
p('<b>Pages 2-5:</b> the recommended map and daily experience.<br/><b>Page 6:</b> exact homes for your twelve areas.<br/><b>Pages 7-8:</b> tender-to-handover and difficult journeys.<br/><b>Pages 9-11:</b> every current primary menu mapped.<br/><b>Pages 12-13:</b> findability checks and user-testing criteria.')
p('<b>Supporting study:</b> existing UI findings and screenshots, pages 14-22; capability existence/need and detail, pages 23-38; original-code scope and validation, pages 39-41; evidence and limits, pages 42-43. Pages 2-13 replace the previous candidate navigation proposal.','small')
p('<b>New requirements, pages 44-53:</b> multiple companies; vendor-based purchase currencies and an FX example; project/company/group reporting; summaries driven by report findings; AI placement, controls, rollout and acceptance checks.','small')
p('<b>Status:</b> this revision extends the study, not the live application. Earlier observations remain dated 28 October 2026 and are not newly retested. It is a recommended information map, not proof of the best possible usability. No application source was copied or new ERP code built.','small')

exec((Path(__file__).resolve().parent/'mapping_content.py').read_text())

begin('Navigation needs a new structure', 'Evidence: E39 administrator dashboard, E41 expanded navigation inventory, E30/E50/E53 role dashboards.')
table(['Role','Primary entries','What this proves'],[
 ('Administrator','42','Broad modules and individual transactions share one level.'),
 ('Project Manager','20','Role filtering still leaves a long operational menu.'),
 ('Site Engineer','10','A smaller role-specific menu already exists.'),
 ('Estimator','9','Tender work can be presented with fewer primary areas.'),
],[CW*0.27,CW*0.16,CW*0.57])
shot('39-admin-fuller-company.png','E39. Administrator in JAKH Demo Contracting LLC. The screenshot shows the first portion of the scrollable sidebar.',300)
p('The fully expanded administrator tree contains <b>363 button controls: 96 groups and 267 leaf buttons</b>, with paths reaching four menu levels. Leaf counts are navigation controls, not a count of unique features.')
p('Repeated leaf labels include Products (6), Customers (4), Settings (12), Dashboard (4), Payments (3), and My Tasks (2). Their targets were not all compared; identical labels do not prove duplicate records or duplicate functionality.','small')

begin('A project should open on work', 'Evidence: E32 project entry and E33 its More menu, viewed as Site Engineer.')
shot('33-site-project-more.png','E33. Marina Gate Residences G+4 opens on Map / Description / Settings. WBS, Contracts, Requisitions and Client certificates sit under More.')
heading('Observed friction')
p('The main project view prioritises a large Dubai map, generic task counts, and project metadata. It does not immediately answer what is happening on site, what is late, what needs approval, or which floor/package needs attention.')
heading('Requirement to validate')
p('Use a project workspace with a stable identity and location/package filter. Put current actions, blockers, recent progress, and relevant documents within that context. Treat maps and administrative settings as supporting information.')
p('Waiting records should name the next owner and expected review date, including when the viewing user cannot approve. The absence of an approval button for a site role may be correct permission behaviour.','small')

begin('Keep the procurement chain connected', 'Observed path: requisition -> linked PO list -> purchase order -> completed receipt. Evidence E19-E22.')
shot('21-purchase-order-record.png','E21. P00005 shows received/billed quantities and links to the receipt, bill, and requisition. Its main view does not give project/WBS/location the prominence seen on the requisition.')
heading('What works, and where context weakens')
p('The requisition includes the project, WBS, required date, planning-demand reference, and requested location. The PO exposes the vendor, arrival, receipt status and quantities. The receipt exposes the source PO and stock movement. The linkage is present; the user must reconstruct its construction context.')
heading('Requirement to validate')
p('Carry project, package and location visibly across demand, request, quotation, order, receipt, inspection, issue, installation, and invoice. Link distinct controlled records rather than merging them into one editable document.')
p('In this sample, a link labelled 1 Purchase orders opens an intermediate single-row list before the PO. Test direct opening when there is exactly one related record. Partial delivery, rejection, returns and billing exceptions were not executed.','small')

begin('Technical controls exist', 'Evidence: E43 document register, E44 revision history, E45 document-category dropdown.')
shot('44-building-drawing.png','E44. General arrangement drawing JSD-TOW-DWG-001 shows approved revision B as Current and approved revision A as Superseded.')
heading('Preserve revision meaning')
p('The current-versus-superseded distinction is useful. A register also needs to let a site user find the correct approved document for the floor, zone, trade and activity without searching through unrelated projects.')
p('The category control offers Drawing, Submittal, Specification, Method Statement, Inspection / Test Plan, and Correspondence. The fuller register contained 15 drawing records; other category workflows were not demonstrated by populated samples.')
heading('Still to validate')
p('Dedicated RFI routing, drawing release/transmittal, consultant response codes, inspection hold points, document distribution and external-party review. A category called Correspondence does not by itself demonstrate an RFI workflow.','small')

begin('Tower work needs structured locations', 'Evidence: E34 snag register, E35 snag detail, E37-E38 submitted site diary.')
shot('35-snag-record.png','E35. Water ponding on balcony, flat 302 is linked to a project, WBS, BOQ item, contractor and person. Its structured Location is Main site.')
heading('A concrete retrieval problem')
p('The eight displayed open snags all use Main site, including titles referring to a flat or individual villa. For these records, finding work by floor or unit depends on free text. This is a sample-data limitation and an information-structure risk; it does not prove the application cannot represent locations.')
heading('Requirement to validate')
p('Model project -> tower/building -> floor -> unit/zone, with systems and packages linked separately. Test bulk snagging, photos, contractor assignment, rectification, reinspection, reopening and partial handover by location.')
p('The site diary has purposeful Manpower, Equipment, Photos, and Work and events tabs. Keep useful grouping. Its Submitted state and the snag\'s Awaiting Review state need clearer next-review ownership in the captured views.','small')

begin('Connect changes to their consequences', 'Evidence: E46-E47 variation records; E15 client certificate and E29 subcontract service entry.')
shot('47-variation-record.png','E47. A priced MEP variation has project/contract links, quantity, rate, value, pricing owner, and approval actions. No instruction link, notice deadline, or time impact is visible on this record.')
heading('Commercial coverage is present')
p('The sampled client certificate contains cumulative quantities, prior/current/remaining measurements, approved variations, retention/recovery values, an invoice link, and technical/commercial/finance review history. A submitted subcontract service entry also has package, location and quantity context.')
heading('The chain to validate')
p('Source instruction -> required notice -> estimate and cost/time impact -> review -> approval or dispute -> budget/programme change -> measured work -> certification -> invoice -> cash. Include work proceeding before approval and rejected or partially certified amounts.')
p('Missing fields on the sampled variation are not proof of system-wide absence. Contract-specific notice rules, approval authorities and finance treatment require validation with your business owners.','small')

begin('Handover is more than a final account', 'Evidence: E48-E49 final-account workflow; E34-E35 snagging. No closure action was executed.')
shot('49-full-final-account-record.png','E49. The completed retail-fit-out project has an Approved final account and a Close contract and project action. The visible detail focuses on certification, advance recovery and retention.')
heading('Separate three completion questions')
p('<b>Technical readiness:</b> are inspections, testing/commissioning, authority requirements, as-builts, O&M manuals, warranties, training and required snags complete?')
p('<b>Client acceptance:</b> which building, floor, unit or system is accepted, by whom, with what outstanding obligations and defect-liability dates?')
p('<b>Commercial settlement:</b> are measurements, variations, claims, subcontract settlements, retention and final balances agreed?')
p('The sampled final-account screen does not visibly present a structured technical-readiness pack. Backend closure checks and wider handover workflows were not tested. Define the three tracks explicitly before designing the replacement.','small')

coverage_a = [
 ('Tender pipeline / bid decision','Observed: generic CRM entry; estimator preview has no matching opportunities (E51).','Validate bid/no-bid, tender deadlines, qualifications, clarifications, tender security and opportunity access.'),
 ('BOQ / estimate / revisions','Observed: estimates, study versions, pricing, review and transfer links (E05, E52).','Validate take-off detail, quote comparison, exclusions, alternate bids, revision comparison and approval limits.'),
 ('Award / project mobilisation','Observed: estimate-to-quotation/project transfer; setup entry (E05-E07, E26).','Validate contract obligations, responsibilities, programme and budget baseline; direct-award path.'),
 ('Project / tower locations','Observed: location records; fuller building sample uses Main site (E35, E44).','Validate tower/floor/unit/zone hierarchy and large-volume navigation. G+4 is not a high-rise scale test.'),
 ('Budget / cost codes / forecasts','Observed: BOQ/location cost report, source links and approved cost-to-complete forecasts (E66-E69, E90).','Validate item/resource detail, revisions, commitments, incurred costs and cash reconciliation. See pages 29-31.'),
 ('Programme / look-ahead','Observed: 145 progress records; the detail says P6 is schedule master (E79-E80).','Validate activity logic, baselines, imports, look-ahead and delay/EOT linkage. See page 34.'),
 ('Drawings / submittals / documents','Observed: current/superseded drawings and six categories (E43-E45).','Validate submissions, transmittals, distribution, consultant response and overdue review ownership.'),
 ('RFIs / instructions','Not demonstrated as a dedicated workflow in the inspected views.','Trace RFI -> response -> drawing/work instruction -> cost/time consequences. Do not treat a label as proof.'),
 ('Materials / procurement','Observed: demand/request/order/receipt links (E19-E22).','Validate quote comparison, approvals, lead times, partial/rejected delivery, returns and material inspection.'),
 ('Stores / site issues / installation','Navigation and demand links observed; full operational chain not walked.','Trace stock source, reservation, transfer, issue, installed quantity, wastage and cost allocation.'),
 ('Subcontract award / amendments','Navigation and subcontract order/service links observed (E28-E29, E41).','Validate package scope, exclusions, measurement rules, changes, commitments and subcontract securities.'),
 ('Subcontract measurement / payment','Observed: service entries, supplier certificate, bill and retention agreement links (E29, E70-E72).','Validate application -> acceptance -> settlement; rejected work, deductions and correction. See page 28.'),
]
coverage_b = [
 ('Daily reports / labour / plant','Observed: populated diaries with resources and work/events (E36-E38); allocation/feed entries.','Validate who submits/approves, location/package detail, hours, equipment use and cost-feed reconciliation.'),
 ('Quality / HSE / inspections','Observed: non-conformances, inspections and risk assessments; NCR resolution/lifecycle (E56-E59).','Validate ITP hold points, cause/corrective action, independent verification and safety controls. See page 25.'),
 ('Variations / notices / delay','Observed: price/approval states; time/notice chain not visible in sample (E46-E47).','Define instruction evidence, notice dates, cost/time assessment, disputed work and linked approval history.'),
 ('Client measurement / certification','Observed: cumulative BOQ/variation measurement and staged approval (E15).','Validate claimed vs certified/rejected values, evidence, corrections, prior quantities and invoice progression.'),
 ('Finance / cash / accounting','Observed: bill and matched receipt sources. Cash report blocked by policy selection; visible policy list empty (E70, E74-E76, E91-E92).','Validate forecasts, policy setup, reconciliation and original posting/localisation. See pages 27 and 30.'),
 ('Approvals / delegation / exceptions','Observed: role routes/history; PM activity queue has two threshold tasks (E15-E16, E54).','Verify queue coverage for all pending documents; delegation, absence cover, rejection/resubmission and independence.'),
 ('Testing / commissioning','Not demonstrated as an end-to-end workflow in inspected records.','Define system/asset tests, dependencies, witnesses, results, failures/retests and readiness evidence.'),
 ('Snagging /<br/>rectification','Observed: populated snags, owners, before photo and status sequence (E34-E35).','Validate after-photo requirements, independent verification, reopening, bulk capture and unit/system filtering.'),
 ('Handover / defect liability','Not demonstrated as a structured handover pack in the sampled final-account view (E49).','Define partial acceptance, as-builts, O&M, warranties, training, DLP dates, outstanding work and responsibility.'),
 ('Final accounts / retention','Observed: financial final-account workflow; sample Approved and Closed records (E13, E49).','Validate technical/contractual readiness gates, settlement, retention release and auditable reopening.'),
 ('People / assets / shared masters','Observed: equipment, serial/cost and maintenance detail (E61-E64). Most HR/fleet scope remains navigation-only.','Validate asset custody, utilisation, hire, finance and handover; retain required HR/shared scope. See page 26.'),
 ('Portals / integrations / migration','Role chooser exposes client/subcontractor portals; schedule and cost feeds have entries.','Verify portal permissions, external reviews, integration ownership, data/attachment export, migration and cutover.'),
]

begin('Construction coverage map - 1', 'Observed means visible in this run. Not demonstrated means unverified, not proven absent. Execution/approval transitions were not performed.')
table(['Lifecycle area','Current evidence','Requirement / next verification'],coverage_a,[CW*0.23,CW*0.34,CW*0.43])

begin('Construction coverage map - 2', 'This map is a requirements register for the new ERP. Supporting functions remain in scope even when sampled only through navigation.')
table(['Lifecycle area','Current evidence','Requirement / next verification'],coverage_b,[CW*0.23,CW*0.34,CW*0.43])

exec((Path(__file__).resolve().parent/'extension_content.py').read_text())

begin('Define an original application', 'Rebuild boundary and migration study. The current product supplies observable business requirements, not implementation code.')
heading('No Odoo application-code dependency')
p('Build original source, data models, APIs, approval/state rules and UI. Do not copy, translate or adapt Odoo modules or application code. No existing source code was inspected during this study. Selection of framework, database and deployment architecture remains a later engineering decision.')
heading('Core domain relationships to specify')
p('Company and authority -> party/person -> opportunity/tender -> estimate revision -> contract and BOQ baseline -> project, location and WBS/package -> demand and commitment -> delivery/service/progress evidence -> variation/certificate -> invoice/payment -> handover/defect obligation.')
p('Keep document revisions, financial postings, approval events and operational evidence linked but distinct. Define stable identifiers, permissions, immutable approved snapshots, corrections, search, attachments and audit history across those relationships.')
p('Explicit domain scope also includes quality/NCR, asset custody/maintenance/hire, waste, changes/notices, programme/delay, item/resource allocations, cash forecasts and KPIs. Company ownership, currency/rate snapshots, intercompany links, scoped report runs and verified findings are foundations. AI uses these controlled records and services; see pages 44-53.','small')
heading('Finance and supporting ERP scope')
p('Specify original accounting/posting and reconciliation requirements with the finance owner. Inventory the required HR, attendance, leave, timesheet, plant, fleet, master-data and administration functions. Integration decisions require explicit scope; they must not quietly replace requested functionality.')
heading('Migration and cutover requirements')
table(['Step','Evidence required before production use'],[
 ('Inventory and export','Authorised exports of records, identifiers, attachments, companies, currencies, statuses, approvals and ownership.'),
 ('Map and trial-migrate','A field/state map and repeatable trial import; preserve relationships and approved historical meaning.'),
 ('Reconcile','Counts, opening balances, inventory, open orders, project budgets/costs, certificates, claims, retention and attachments checked by owners.'),
 ('Pilot and cut over','One representative project plus exceptions; parallel reconciliation, backups, rollback and agreed transition responsibilities.'),
],[CW*0.26,CW*0.74])

begin('Validate before detailed design', 'The read-only study is ready for review. Detailed design and application coding remain behind the requested review point.')
heading('Priority sequence - the full scope remains')
table(['Priority','Outcome'],[
 ('First: navigation and context','Agree roles, canonical records, project/floor/package context, terminology and an understandable work queue.'),
 ('Next: tower workflow depth','Resolve engineering-to-site, instruction-to-variation/time, package-to-measurement, and technical-to-commercial closeout handoffs.'),
 ('Then: coherent original ERP','Design and build the lifecycle in increments, including original finance controls and the required supporting modules.'),
 ('Before replacement','Trial migration, representative-user validation, accounting/control review, security/access testing, integration checks and a controlled pilot.'),
],[CW*0.30,CW*0.70])
heading('Tasks for the next validation round')
p('1. Find the approved drawing for one tower floor and confirm which revision may be used.<br/>2. Request a material, follow a partial/rejected delivery, and find the installed quantity.<br/>3. Trace a subcontract package from measured work through payment.<br/>4. Record an instruction, identify cost/time consequences, and follow its approval or dispute.<br/>5. Explain claimed, certified, invoiced and collected values for one period.<br/>6. Find all snags in one unit, verify the fix, and check partial-handover readiness.')
p('Use you and representative estimator, site, procurement, QS/PM, quality/document-control and finance users where available. Measure unassisted completion, time to the correct information, wrong turns, repeated entry and missed handoffs. Use the proposed targets on page 13, record a real baseline, and agree gates before testing; no staff usability test has yet been run.')
heading('Decisions still needed')
p('Confirm actual roles/approval authority, contract types, floor/unit structure, consultant/client/subcontractor participation, document and programme tools, accounting/localisation needs, languages/mobile/offline needs, project volumes and migration depth. A delivery estimate should follow this scope, not precede it.','small')
heading('Terms used in the study')
p('BOQ: bill of quantities. WBS: work breakdown structure. QS: quantity surveyor. RFI: request for information. ITP: inspection/test plan. EOT: extension of time. DLP: defect-liability period. O&M: operation and maintenance.','small')

begin('Twelve validation scenarios', 'Proposed acceptance work after study review. These scenarios have not been executed against the current ERP.')
table(['Area','Evidence needed to accept the workflow'],[
 ('1. NCR','A failed inspection reaches authorised repair and verified closure; cause, effectiveness, location and rework costs remain linked.'),
 ('2. Assets','One owned and one hired asset can be assigned, moved, maintained and costed; one installed asset has an exportable handover pack.'),
 ('3. Cash','Partial payments, advance recovery, retention and late receipts reconcile between project forecasts, ledgers and bank evidence.'),
 ('4. Subcontracting','A partly rejected claim produces the right certificate, deduction, bill and payment; package totals and final retention reconcile.'),
 ('5. Item cost','One floor item reconciles original/revised budget, resources, incurred cost/accruals, remaining obligations, cash and forecast without duplication.'),
 ('6. Waste','One material quantity balance closes; a disposal/recovery movement has ownership, destination evidence and allocated cost.'),
 ('7. Changes','One instructed but disputed change retains notices, assessment, decision versions and downstream budget/order/programme links.'),
 ('8. Programme / delay','One delayed prerequisite is traced to affected activities, mitigation, forecast finish and a versioned time assessment.'),
 ('9. KPIs','A metric reconciles to its source population and produces one accountable action when its agreed threshold is crossed.'),
 ('10. Records','A historical work event can be reconstructed using the correct document revisions, correspondence, photos and approval evidence.'),
 ('11. Approvals','Test delegation, limits, rejection, changed documents and concurrency; the personal queue matches pending business decisions.'),
 ('12. Transparency','A permitted user traces a dashboard total to source events; a user outside that scope cannot access it through links or exports.'),
],[CW*.25,CW*.75])
heading('Sequence and release priorities')
p('<b>First:</b> agree IDs, location/work-item structure, definitions, records, approvals and history. <b>Then:</b> validate integrated project scenarios across all twelve areas; deepen NCR/waste, programme/delay and cash/item allocation where evidence is weakest. <b>Before release:</b> prove roles, reconciliation, migrations and recovery with representative users.')
p('All twelve remain in scope. Advanced analytics and automation can follow reliable operational capture; essential site, cash, quality and approval controls must not be postponed merely for a cleaner-looking first screen.','small')

begin('Evidence and limits', 'Primary source: live UI at https://demo.jakh.net/ on 28 October 2026. Evidence IDs match saved screenshot and accessibility-snapshot prefixes.')
table(['Evidence','Observed route / role / purpose'],[
 ('E02, E39, E41','Administrator dashboards and complete expanded sidebar. E41 is an accessibility inventory, not a single screenshot.'),
 ('E05-E07','My Company / USD: estimate EST/2026/00004 -> linked project and project shortcuts.'),
 ('E15-E17','My Company / USD: measured client certificate -> contract -> cash/closeout tab.'),
 ('E19-E22','My Company / USD: material-shortage requisition -> P00005 -> JD2/IN/00001 receipt.'),
 ('E28-E29','My Company / USD: subcontract service entries and submitted review record.'),
 ('E30-E38','Site Engineer, JAKH Demo Contracting LLC / AED: project portfolio, G+4 project, snags and diary.'),
 ('E40, E42','Administrator, fuller company: G+4 construction report and schedule-progress register.'),
 ('E43-E45','Administrator, fuller company: document register, G+4 drawing revision history and category menu.'),
 ('E46-E49','Administrator, fuller company: variations and the approved completed-project final account.'),
 ('E50-E52','Estimator: role dashboard, CRM entry and eight BOQ studies.'),
 ('E53-E54','Project Manager: role dashboard and two-item activities/approvals queue.'),
 ('E55','Administrator returned to original My Company context and normal browser viewport.'),
],[CW*0.22,CW*0.78])
heading('Scope limits that affect the conclusions')
p('The first administrator view selected My Company (USD); role previews opened JAKH Demo Contracting LLC (AED), which has fuller samples. Empty initial lists are not proof of absent features. The study inspected a G+4 building and villa/fit-out examples, not high-rise operating scale.')
p('Only navigation, view filters, role previews, record/form reading and report generation/viewing were used. Unsaved scrap and report criteria were discarded. Generated report-view records are the only new records from these inspections. No business document was edited, approved, posted, paid, closed or deleted; no source-code audit, migration, reconciliation or state-transition test was performed.','small')
p('Accessibility observations are risks to verify: truncation, small/dense text, colour-dependent cues and tab-state semantics. Keyboard/focus, screen-reader behaviour, measured contrast and error recovery were not tested. Screenshot blank capture margins are omitted only in PDF placement; visible content is unchanged. Early clipped capture E07 is excluded from visual conclusions in favour of E33.','small')

begin('Follow-up evidence and reference', 'Administrator in JAKH Demo Contracting LLC / AED, then restored to My Company. Public reference reviewed separately; no ERP data was sent to it.')
table(['Evidence','Observed purpose / result'],[
 ('E56-E59','Quality register -> building Non-conformance -> Resolution -> Lifecycle. Populated, closed case; no transition executed.'),
 ('E60','Public QIC NCR toolkit product description, accessed 28 October 2026. Paid documents not inspected.'),
 ('E61-E64','Equipment register -> tower crane -> Product Information -> Maintenance. Identity, cost, location gap and reliability fields.'),
 ('E65-E69','BOQ report selector -> dashboard-generated building report -> detail/optional columns -> source facts. Selector did not offer the existing project; dashboard route succeeded.'),
 ('E70-E72','Source fact -> subcontract bill -> supplier certificate -> finance agreement. Quantities, deductions, approvals and balances.'),
 ('E73-E76','Company cash report -> policy prerequisite error -> empty policy register -> empty project cash-forecast register.'),
 ('E77-E78','Empty scrap register -> unsaved form, then discard. No scrap or inventory adjustment created.'),
 ('E79-E80','Schedule register -> accepted building progress record. P6 named as master; manual source shown.'),
 ('E81-E84','Project-control facts, document turnaround and saved generic dashboards. Record lineage differs from full change-event auditing.'),
 ('E85-E86','Variation register -> priced building MEP change. Commercial lifecycle and scope links observed.'),
 ('E87-E90','WBS -> budget record -> forecast register -> approved structural forecast. Authoritative dated forecast differs from simple WBS field.'),
 ('E91-E93','Matched receipt sources -> posted journal entry -> original dashboard/company restored. No payment/reversal action executed.'),
],[CW*.21,CW*.79])
heading('Source and interpretation limits')
p('<link href="https://pauligle.gumroad.com/l/ncr-management-kit" color="#28675F">QIC Management Systems: NCR Management Toolkit public description</link>. Its form/procedure/register/dashboard outline informed the NCR comparison. The requirements and UI placement in this report are our proposed construction brief; they do not reproduce or validate the paid toolkit or establish ISO compliance.','small')
p('An empty list applies only to the inspected role/company/filter context. Fields or capabilities not visible in sampled records are labelled unverified, not globally absent. Sample totals and same-person approvals are evidence of these examples, not proof of accounting correctness or permission enforcement. The public demo can change or reset. Detailed design and coding remain subject to your study review.','small')
exec((Path(__file__).resolve().parent/'company_currency_ai_content.py').read_text())
finish()
c.save()
import json
(OUT/'report-layout-metrics.json').write_text(json.dumps(page_metrics,indent=2))
print(f'Created {PDF} ({page_no} pages)')
print(json.dumps(page_metrics))
