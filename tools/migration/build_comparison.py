"""Rebuild the evidence-grounded comparison from retained navigation and authored requirements.

Run with the bundled Python (reportlab/Pillow) from any working directory.
No network, legacy application code, runtime database, or credentials are read.
"""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from collections import Counter
import csv, hashlib, html, json, re, shutil, subprocess, os
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from comparison_content import DOMAINS, LEAF_SPECS
from report_sections import OPENING, ADDITIONS, DATA_CONTRACTS, USER_COVERAGE

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/migration'
OUT.mkdir(parents=True, exist_ok=True)
ARCHIVE = ROOT / 'docs/study/Source-evidence.zip'
BASELINE = '3d941a0'
SOURCE_NAV = 'jakh-study-evidence/41-admin-navigation-expanded-ax.txt'
with ZipFile(ARCHIVE) as z:
    nav = z.read(SOURCE_NAV).decode()
    source_manifest = [{'path': n, 'sha256': hashlib.sha256(z.read(n)).hexdigest(), 'bytes': len(z.read(n))}
                       for n in z.namelist() if not n.endswith('/')]
nav = nav[nav.index('\t\t\t\t8 content list'):]
controls, stack = [], []
for line in nav.splitlines():
    m = re.match(r'^(\t+)(\d+) button(?: \((expanded|collapsed)\))? (.*)$', line)
    if not m: continue
    depth, ax, group = len(m[1]), int(m[2]), bool(m[3])
    if depth < 5: break
    label = re.sub(r'^Description: ', '', m[4]).split(', Secondary Actions:')[0]
    while stack and stack[-1][0] >= depth: stack.pop()
    path = [s[1] for s in stack] + [label]
    controls.append(dict(ax=ax, path=path, group=group))
    if group: stack.append((depth,label))
leaves = [r for r in controls if not r['group']]
roots = list(dict.fromkeys(r['path'][0] for r in controls))
assert len(controls)==363 and len(leaves)==267 and len(roots)==42
specs = [line.split('|') for line in LEAF_SPECS.strip().splitlines()]
assert all(len(s)==3 for s in specs)
assert [int(s[0]) for s in specs] == list(range(1,268))
domain_by_root = {r:d for d in DOMAINS for r in d['roots']}
assert set(roots)==set(domain_by_root)

ROOT_ROUTES = {
 'Dashboard':'My Work / Project Overview / Company Overview',
 'Reports':'Project or Company > Reports',
 'My Approvals & Activities':'My Work > Approvals & activities',
 'CRM':'Tenders > Opportunities', 'Tender & BOQ':'Tenders > Estimates',
 'Sales & Quotations':'Tenders > Quotations & awards', 'Projects':'Projects > Project workspace',
 'Project requisitions':'Project > Buying > Requests', 'Project set-up':'Project > Plan > Set-up',
 'Material returns':'Project > Site > Materials > Returns', 'WBS & Budgets':'Project > Plan > Work & budget',
 'Site receipts':'Project > Buying > Orders & deliveries > Receive', 'Site diaries':'Project > Site > Daily work',
 'Contracts & measured BOQ':'Project > Costs & Contracts > Client contract',
 'Site materials & issues':'Project > Site > Materials & waste', 'Purchasing':'Project / Company > Buying',
 'Payment certificates':'Project > Costs & Contracts > Claims & certificates',
 'Advances & retention releases':'Project > Costs & Contracts > Advances & retention',
 'Final accounts & closeout':'Project > Costs & Contracts > Final account',
 'Guarantees & bonds':'Project > Costs & Contracts > Securities',
 'Subcontract finance':'Project > Buying > Subcontracts > Finance',
 'Subcontract order amendments':'Project > Buying > Subcontracts > Amendments',
 'Subcontractor applications':'Project > Buying > Subcontracts > Applications',
 'Subcontract service entries':'Project > Buying > Subcontracts > Measurements',
 'Subcontract work corrections':'Project > Buying > Subcontracts > Corrections',
 'Stores & Receipts':'Company > Stores; project material views',
 'Labour & plant allocation':'Project > Site > Resources > Plan',
 'Labour & plant actual feeds':'Project > Site > Resources > Actuals',
 'P6 schedule progress':'Project > Plan > Programme & progress', 'Finance':'Company > Finance',
 'Quality, HSE & Specifications':'Project > Site / Documents / Handover',
 'People & HR':'Company > People > Employees', 'Time Off':'Company > People > Leave',
 'Attendance':'Company > People > Attendance', 'Timesheets':'Company > People > Timesheets',
 'Plant & Equipment':'Company > Assets & fleet > Equipment', 'Fleet':'Company > Assets & fleet > Vehicles',
 'Contacts & Masters':'Company > Contacts & catalogue', 'Team Discussions':'My Work > Discussions',
 'My Tasks':'My Work > Tasks', 'Users & Access':'Company > Administration > Access',
 'Administration':'Company > Administration',
}

# Exact rows with related executable functionality. None establishes full parity.
PARTIAL = {1,5,8,21,56,70,238}
EXAMPLES = {22,39,72,76,79,80,91,92,93,95,96,99,100,102,105,106,118,120,
            148,149,150,159,192,193,200,201,202}
DIRECT = {
 1:'Fresh dashboard and 02', 3:'73-74',4:'75',5:'Fresh control report and 65-69',
 8:'40, 65-69',9:'89-90',10:'76',14:'81',16:'82',17:'83-84',21:'54',
 22:'51',39:'05',40:'52',56:'06-07, 31-33',70:'18-19',71:'26',73:'24-25, 87-88',
 75:'22',76:'36-38',77:'16-17',79:'46-47, 85-86',82:'20-21',91:'14-15',93:'12-13, 48-49',
 95:'72',96:'71',99:'27',100:'28-29',106:'77-78',120:'42, 79-80',124:'91-92',127:'70',
 148:'10-11, 34-35',149:'56-59',150:'09, 43-45',151:'82',202:'61-64'
}
LINK_ONLY = {42:'05 quotation link',43:'16 sales-order link',92:'16-17 advance/release links',97:'72 advance/release links',
             132:'92 payment journal evidence',133:'92 payment journal evidence',201:'64 maintenance links'}

def leaf_route(n,r):
    base = ROOT_ROUTES[r['path'][0]]
    overrides={5:'Project > Costs & Contracts > Cost control',8:'Project > Costs & Contracts > CVR',
      9:'Project > Costs & Contracts > Forecasts',79:'Project > Costs & Contracts > Changes',
      21:'My Work > Approvals & activities',22:'Tenders > Opportunities',23:'My Work > Activities · Opportunity filter',
      24:'Tenders > Quotations · My opportunities',38:'Tenders > Estimates · Import BOQ',
      39:'Tenders > Estimates · BOQ & pricing',40:'Tenders > Estimates · Versions',41:'Tenders > Estimates · Analysis',
      42:'Tenders > Quotations',43:'Tenders > Awards & orders',56:'Projects > Project workspace',
      57:'My Work > Tasks · Project filter',58:'Project > Plan > Tasks',73:'Project > Plan > Work & budget',
      74:'Project > Plan > Work & budget · Revisions',77:'Project > Costs & Contracts > Client contract',
      78:'Project > Costs & Contracts > Client contract · BOQ revisions',
      81:'Project / Company > Buying > Sourcing',82:'Project / Company > Buying > Orders & deliveries',
      83:'Company > Buying > Agreements',88:'Company > Buying > Supplier prices',
      95:'Project > Buying > Subcontracts · Finance terms',96:'Project > Buying > Subcontracts · Certificates',
      97:'Project > Buying > Subcontracts · Advances & retention',
      148:'Project > Handover > Snags & defects',149:'Project > Site > Quality & safety',
      150:'Project > Documents > Controlled documents',151:'Project > Documents > Reviews',
      152:'Company > People > Employees',153:'Company > People > Directory',159:'Company > People > Onboarding & offboarding',
      168:'My Work > Leave · Calendar',169:'My Work > Leave · Requests',181:'My Work > Attendance',
      192:'My Work > Timesheets',193:'Company > People > Timesheets · Review',
      202:'Company > Assets & fleet > Equipment',207:'Company > Assets & fleet > Vehicles',
      222:'Company > Contacts & catalogue > Contacts',229:'My Work > Discussions',238:'My Work > Tasks',
      239:'Company > Administration > Access · Add user',240:'Company > Administration > Access · Users',
      241:'Company > Administration > Access · Role presets',242:'Company > Administration > Access · Advanced settings',
      249:'Company > Administration > Cost codes',250:'Project > Plan > Locations; Company > Administration',
      264:'Company > Administration > AI connections',265:'Company > Administration > General settings',
      266:'Company > Administration > Access · Users',267:'Company > Administration > Companies'}
    if n in overrides:return overrides[n]
    if n in {26,44,126}:return 'Company > Contacts & catalogue > Customers · Contextual views'
    if n in {84,131}:return 'Company > Contacts & catalogue > Vendors · Company terms'
    if n in {45,85,108,125,130}:return 'Company > Contacts & catalogue > Products & services · Contextual fields'
    if 'Configuration' in r['path']:
        # Settings are named sections, not another recursive daily menu tree.
        label=r['path'][-1]
        base='Company > Administration > '+r['path'][0]+' settings'
        return base+(' · '+label if label!='Settings' else '')
    label=re.sub(r'^Open ', '', r['path'][-1])
    return base+(' · '+label if len(r['path'])>1 else '')

rows=[]
for n,(leaf,spec) in enumerate(zip(leaves,specs),1):
    d=domain_by_root[leaf['path'][0]]
    status='Partial implementation' if n in PARTIAL else 'Example only' if n in EXAMPLES else 'Not implemented'
    observation='Screen/form recorded' if n in DIRECT else 'Linked record only' if n in LINK_ONLY else 'Navigation only'
    refs=DIRECT.get(n,LINK_ONLY.get(n,'41 (destination label only)'))
    if n in (1,5):observation='Screen rechecked this review'
    rows.append(dict(id=f'F{n:03}',legacy_area=leaf['path'][0],legacy_path=' > '.join(leaf['path']),
        legacy_ax_id=leaf['ax'],domain=d['id'],proposed_destination=leaf_route(n,leaf),builder_status=status,
        builder_gap=d['current'],preserve_or_add=spec[1],acceptance_example=spec[2],
        acceptance_status='NOT RUN - proposed parity acceptance',source_observation=observation,
        source_evidence=refs,domain_evidence=d['evidence'],source_navigation=SOURCE_NAV,
        required_data=d['data'],remaining_verification=d['verify'],disposition='Retain in scope; original implementation',
        builder_evidence='app/server/db.mjs; app/server/http.mjs; app/server/service.mjs; app/src/catalogue.js @ '+BASELINE))

contracts=[]
for n,line in enumerate(DATA_CONTRACTS.strip().splitlines(),1):
    a=line.split('|'); assert len(a)==7
    contracts.append(dict(id=f'M{n:02}',subject=a[0],source_visible_label_or_requirement=a[1],proposed_target=a[2],
      required_fields=a[3],current_builder_gap=a[4],migration_invariant=a[5],evidence=a[6],
      mapping_status='PROPOSED - exact source export schema and target implementation pending'))

def dump_csv(path, data):
    with path.open('w',newline='',encoding='utf-8-sig') as f:
        w=csv.DictWriter(f,fieldnames=list(data[0]));w.writeheader();w.writerows(data)
root_rows=[]
for i,r in enumerate(roots,1):
    rr=[x for x in rows if x['legacy_area']==r]; d=domain_by_root[r]
    root_rows.append(dict(id=f'A{i:02}',legacy_area=r,leaf_count=len(rr),first_id=rr[0]['id'],last_id=rr[-1]['id'],
      domain=d['id'],proposed_destination=ROOT_ROUTES[r],current_status=d['current'],source_evidence=d['evidence']))
dump_csv(OUT/'Builder-ERP-267-Function-Comparison.csv',rows)
dump_csv(OUT/'Builder-ERP-42-Area-Map.csv',root_rows)
dump_csv(OUT/'Builder-ERP-Data-Contracts.csv',contracts)
requirements=[]
for line in USER_COVERAGE.strip().splitlines():
    a=line.split('|');assert len(a)==6
    requirements.append(dict(id=a[0],user_requirement=a[1],related_functions=a[2],report_sections=a[3],current_builder_status=a[4],required_result=a[5]))
dump_csv(OUT/'Builder-ERP-User-Requirements-Coverage.csv',requirements)
payload=dict(title='Builder ERP - Functional comparison and migration correction',date='2026-10-28',baseline_commit=BASELINE,
  counts=dict(primary_areas=42,leaf_controls=267,navigation_groups=96,domains=21,data_contracts=34),
  caveat='Inventory comparison, not certified behavioural parity or completed migration. No acceptance scenario has been run for parity.',
  statuses=dict(Counter(r['builder_status'] for r in rows)),roots=root_rows,domains=DOMAINS,functions=rows,data_contracts=contracts,user_requirements=requirements)
(OUT/'comparison.json').write_text(json.dumps(payload,indent=2,ensure_ascii=False))
manifest=dict(legacy_archive=str(ARCHIVE.relative_to(ROOT)),archive_sha256=hashlib.sha256(ARCHIVE.read_bytes()).hexdigest(),
  source_navigation=SOURCE_NAV,source_entries=source_manifest,current_review=[])
for p in sorted((OUT/'evidence').glob('*')):
    manifest['current_review'].append(dict(path=str(p.relative_to(OUT)),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),bytes=p.stat().st_size))
(OUT/'Evidence-manifest.json').write_text(json.dumps(manifest,indent=2))

# Self-contained, offline register. Dynamic content is escaped; no network or external libraries.
def e(x):return html.escape(str(x),quote=True)
cards=[]
for r in rows:
    search=' '.join(str(v) for v in r.values()).lower()
    fields=[('Proposed home',r['proposed_destination']),('What Builder actually has',r['builder_gap']),
      ('Required behaviour',r['preserve_or_add']),('Acceptance example - not yet run',r['acceptance_example']),
      ('Required data',r['required_data']),('Source evidence',r['source_observation']+'; '+r['source_evidence']),
      ('Further verification',r['remaining_verification'])]
    cards.append(f'<details class="function" data-root="{e(r["legacy_area"])}" data-status="{e(r["builder_status"])}" data-search="{e(search)}"><summary><span class="fid">{r["id"]}</span><span>{e(r["legacy_path"])}</span><span class="badge">{e(r["builder_status"])}</span></summary><div class="detail">'+''.join(f'<h4>{e(k)}</h4><p>{e(v)}</p>' for k,v in fields)+f'<p class="muted">Domain <a href="#{r["domain"]}">{r["domain"]}</a> · Navigation evidence 41, AX {r["legacy_ax_id"]}. Source behaviour is not certified.</p></div></details>')
domain_cards=[]
for d in DOMAINS:
    fields=[('Source evidence',d['evidence']),('JAKH observation',d['observed']),('Builder today',d['current']),
      ('Preserve / implement',d['preserve']),('Data and relationships',d['data']),('Still to verify',d['verify']),('Acceptance example',d['example'])]
    domain_cards.append(f'<details id="{d["id"]}" class="domain"><summary>{d["id"]} · {e(d["title"])}</summary><div class="detail"><p class="route">{e(d["route"])}</p>'+''.join(f'<h4>{e(k)}</h4><p>{e(v)}</p>' for k,v in fields)+'</div></details>')
HTML='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Builder ERP - Full comparison register</title>
<style>:root{font-family:system-ui,sans-serif;color:#203238;background:#f4f7f6;line-height:1.55}*{box-sizing:border-box}body{margin:0}main{max-width:1120px;margin:auto;padding:32px 24px 70px}h1{font-size:34px;line-height:1.15;margin:8px 0 18px}h2{margin-top:36px;font-size:23px}h3{font-size:17px}h4{margin:17px 0 3px;font-size:14px;color:#28675f}p{margin:0 0 14px}a{color:#246258}header p{max-width:850px}.eyebrow{font-size:13px;letter-spacing:.08em;color:#28675f;font-weight:700}.notice{border-left:4px solid #c38127;background:#fff6e8;padding:16px 20px;margin:20px 0}.stats{display:flex;gap:12px;flex-wrap:wrap}.stats div{background:#fff;border:1px solid #d6e0dd;border-radius:8px;padding:12px 18px}.stats strong{font-size:23px;display:block}.filters{background:#fff;border:1px solid #d6e0dd;padding:16px;border-radius:10px;display:flex;gap:14px;align-items:end;flex-wrap:wrap}label{font-size:13px;font-weight:650;display:flex;flex-direction:column;gap:6px}input,select,button{font:inherit;padding:10px;border:1px solid #a6b6b1;border-radius:5px;max-width:100%;background:#fff;color:#203238}input{min-width:280px}button{cursor:pointer}button:hover{background:#edf3f2}:focus-visible{outline:3px solid #b37220;outline-offset:3px}details{border:1px solid #d6e0dd;background:#fff;border-radius:8px;margin:9px 0;scroll-margin-top:20px}summary{cursor:pointer;padding:15px 18px;font-weight:650;display:flex;gap:12px;align-items:center}summary::before{content:'+';color:#28675f}details[open]>summary::before{content:'−'}details[open]>summary{border-bottom:1px solid #d6e0dd}.fid{font-size:13px;color:#536b65;min-width:39px}.badge{margin-left:auto;white-space:nowrap;font-size:12px;font-weight:600;background:#f0f3f1;border-radius:20px;padding:3px 10px}.detail{padding:4px 24px 20px;max-width:1000px}.muted{color:#5b6c67;font-size:13px}.route{font-weight:600;margin-top:14px}.toolbar{display:flex;justify-content:space-between;align-items:center;margin:14px 0;gap:10px}.links{display:flex;gap:20px;flex-wrap:wrap}.domain summary{color:#28675f}footer{margin-top:36px;border-top:1px solid #cedbd6;padding-top:18px;font-size:13px} [hidden]{display:none!important}@media(max-width:650px){main{padding:24px 14px}h1{font-size:29px}summary{flex-wrap:wrap;padding:13px}.badge{margin-left:0}input{min-width:0;width:100%}.filters>label{width:100%}.toolbar{align-items:start}.detail{padding:4px 16px 15px}}@media print{.filters,.toolbar button{display:none}details{break-inside:avoid}body{background:white}summary{display:block}.badge{margin-left:10px}}</style>
<main><header><p class="eyebrow">BUILDER ERP · 28 OCTOBER 2026 · LOCAL COMPARISON</p><h1>What JAKH has.<br>What Builder still needs.</h1><p>The current build does not meet the requested full migration. This register accounts for every recorded destination and keeps its business purpose in scope while proposing a simpler home.</p><div class="stats"><div><strong>42</strong>primary areas</div><div><strong>267</strong>destination controls</div><div><strong>21</strong>workstream comparisons</div><div><strong>34</strong>proposed data contracts</div></div><div class="notice"><strong>Evidence, not a completion claim.</strong> No destination is certified as full parity. Menu-only observations do not prove workflow behaviour. All acceptance examples are proposed and not yet run for migration parity. Counts describe navigation coverage, not a feature-completion percentage.</div><p class="links"><a href="Builder-ERP-Full-Comparison.pdf">Read the comparison report</a><a href="Builder-ERP-267-Function-Comparison.csv">Download 267-row CSV</a><a href="Builder-ERP-Data-Contracts.csv">Download data contracts</a></p></header>
<h2>Find an existing function</h2><p>Search old menu names, business terms, expected behaviour or examples. Each row explains the current gap and proposed destination.</p><div class="filters"><label>Search<input id="search" type="search" placeholder="Try retention, BOQ, leave or P6"></label><label>Original area<select id="area"><option value="">All 42 areas</option>__OPTIONS__</select></label><label>Builder status<select id="status"><option value="">All statuses</option><option>Partial implementation</option><option>Example only</option><option>Not implemented</option></select></label><button id="reset">Clear filters</button></div><div class="toolbar"><p id="count" role="status" aria-live="polite">267 destinations</p><button id="expand" aria-expanded="false">Expand visible rows</button></div><section id="functions" aria-label="Function comparison">__CARDS__</section><p id="empty" hidden>No destinations match these filters. Clear a filter or try another legacy term.</p>
<h2>Understand the connected workflow</h2><p>These comparisons explain the business rules, relationships and migration evidence behind the individual destinations.</p><section>__DOMAINS__</section><footer><p>Compared Builder application commit 3d941a0. Source: retained read-only JAKH study evidence, plus fresh dashboard/control-report checks. All proposed destinations and acceptance cases require implementation and validation.</p><p>No Odoo application code is included. Local only; no deployment or GitHub push. This page has no network dependencies.</p></footer></main>
<script>const rows=[...document.querySelectorAll('.function')], search=document.querySelector('#search'),area=document.querySelector('#area'),status=document.querySelector('#status'),count=document.querySelector('#count'),expand=document.querySelector('#expand');function filter(){let n=0;const q=search.value.trim().toLowerCase();for(const r of rows){r.hidden=!!((area.value&&r.dataset.root!==area.value)||(status.value&&r.dataset.status!==status.value)||(q&&!r.dataset.search.includes(q)));if(!r.hidden)n++;}count.textContent=n+' of 267 destinations';document.querySelector('#empty').hidden=n!==0;expand.disabled=n===0;}for(const input of [search,area,status])input.addEventListener('input',filter);document.querySelector('#reset').addEventListener('click',()=>{search.value='';area.value='';status.value='';filter();search.focus()});expand.addEventListener('click',()=>{const open=expand.getAttribute('aria-expanded')!=='true';for(const r of rows)if(!r.hidden)r.open=open;expand.setAttribute('aria-expanded',String(open));expand.textContent=open?'Collapse visible rows':'Expand visible rows'});document.querySelectorAll('a[href^="#D"]').forEach(a=>a.addEventListener('click',()=>{document.querySelector(a.getAttribute('href')).open=true}));filter();</script></html>'''
HTML=HTML.replace('__OPTIONS__',''.join(f'<option>{e(r)}</option>' for r in roots)).replace('__CARDS__',''.join(cards)).replace('__DOMAINS__',''.join(domain_cards))
(OUT/'Builder-ERP-Comparison-Register.html').write_text(HTML)

# PDF: deliberately readable domain pages; complete per-destination detail is in the register/CSV.
fontdir=Path('/Users/jameelkhabaze/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/libreoffice-headless/libreoffice/LibreOfficeDev.app/Contents/Resources/fonts/truetype')
for name,f in [('D','DejaVuSans.ttf'),('DB','DejaVuSans-Bold.ttf')]:pdfmetrics.registerFont(TTFont(name,str(fontdir/f)))
pdfmetrics.registerFontFamily('D',normal='D',bold='DB',italic='D',boldItalic='DB')
W,H=595.276,841.89; M=42; CW=W-2*M
INK=colors.HexColor('#203238');TEAL=colors.HexColor('#28675f');MUTED=colors.HexColor('#576b65');LINE=colors.HexColor('#d7e1df')
pdf=OUT/'Builder-ERP-Full-Comparison.pdf'
c=canvas.Canvas(str(pdf),pagesize=(W,H),pageCompression=1)
c.setTitle('Builder ERP - Functional comparison and migration correction')
c.setAuthor('Codex for Builder ERP')
c.setSubject('42 source areas, 267 recorded destination controls; gaps, preservation rules and migration gates')
page=0; metrics=[]
def clean(s):return str(s).replace('\u2011','-').replace('\u2013','-').replace('\u2014','-').replace('\u00a0',' ')
def para(s,size=10.1,lead=None,bold=False,color=INK):
    return Paragraph(e(clean(s)),ParagraphStyle('p',fontName='DB' if bold else 'D',fontSize=size,leading=lead or size*1.43,textColor=color))
def draw(p,x,y,w=CW):
    _,h=p.wrap(w,H);p.drawOn(c,x,y-h);return y-h
def begin(title,label):
    global page
    if page:c.showPage()
    page+=1;c.bookmarkPage(f'p{page}');c.addOutlineEntry(title,f'p{page}',0,False)
    c.setFillColor(TEAL);c.setFont('DB',8);c.drawString(M,H-30,'BUILDER ERP  /  FUNCTIONAL COMPARISON')
    c.setFillColor(MUTED);c.setFont('D',8);c.drawRightString(W-M,H-30,'28 October 2026')
    c.setStrokeColor(LINE);c.line(M,41,W-M,41)
    c.setFont('D',7.6);c.drawString(M,27,'Local only  |  Parity and migration not yet certified');c.drawRightString(W-M,27,str(page))
    y=draw(para(title,22,28,True),M,H-59)-10
    y=draw(para(label,8.8,12.5,color=MUTED),M,y)-19
    return y
def page_blocks(title,label,blocks):
    y=begin(title,label); top=y
    for size in [10.1,9.8,9.5,9.2]:
        ps=[];height=0
        for h,t in blocks:
            hp=para(h,11.1,15,True,TEAL);bp=para(t,size,size*1.42)
            height+=hp.wrap(CW,H)[1]+4+bp.wrap(CW,H)[1]+12;ps.extend([(hp,4),(bp,12)])
        if height <= top-52:break
    else:raise RuntimeError(f'Page overflow {title}: {height} available {top-52}')
    for p,g in ps:y=draw(p,M,y)-g
    metrics.append(dict(page=page,title=title,font_size=size,bottom=y))

y=begin('The full comparison\nand migration correction','Prepared after the user identified missing JAKH functionality. This supersedes any implication that the first local build establishes migration parity.')
y=draw(para('A simpler interface must preserve the business underneath it.',27,35,True),M,y)-24
for n,l in [('42','existing primary areas'),('267','recorded destination controls'),('21','connected workstream comparisons'),('34','proposed data contracts')]:
    c.setFillColor(TEAL);c.setFont('DB',28);c.drawString(M,y-29,n)
    y=draw(para(l,12,17),M+88,y-6,CW-88)-24
y-=8;y=draw(para('The finding is clear: Builder ERP currently implements a narrow first increment. Most of JAKH\'s operational and financial logic has not been rebuilt. This package records the gaps and the work needed to correct that.',11.5,17),M,y)-20
y=draw(para('Read the report for the connected comparison. Use the searchable HTML register or CSV for every source destination, its proposed home, exact requirement and acceptance example. No function is marked as full parity.',10,14.3,color=MUTED),M,y)
metrics.append(dict(page=page,title='Cover',font_size=10,bottom=y))

for title,blocks in OPENING:page_blocks(title,'Finding, evidence and correction - read before using the register.',blocks)

for start in range(0,42,14):
    y=begin(f'All 42 areas accounted for ({start//14+1}/3)','IDs A01-A42 cover the original primary navigation. Domain pages explain current gaps. Proposed homes are designs, not implemented routes.')
    hdr=['ID / leaves','Original area','Proposed home','Domain / function IDs']
    cells=[[para(s,8.4,11.5,True,colors.white) for s in hdr]]
    for r in root_rows[start:start+14]:
        cells.append([para(r['id']+' / '+str(r['leaf_count']),8.2,11.7),para(r['legacy_area'],8.5,12.2,True),
          para(r['proposed_destination'],8.2,11.7),para(r['domain']+'\n'+r['first_id']+'-'+r['last_id'],7.8,11.2)])
    t=Table(cells,colWidths=[58,134,231,88],repeatRows=1)
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),TEAL),('VALIGN',(0,0),(-1,-1),'TOP'),
      ('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),9),('BOTTOMPADDING',(0,0),(-1,-1),9),
      ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.HexColor('#f0f5f3'),colors.white]),('LINEBELOW',(0,1),(-1,-1),0.4,LINE)]))
    _,h=t.wrap(CW,H);assert y-h>52,(start,y,h);t.drawOn(c,M,y-h);metrics.append(dict(page=page,title=f'42 areas {start}',font_size=8.2,bottom=y-h))

for d in DOMAINS:
    rr=[r for r in rows if r['domain']==d['id']]
    blocks=[('JAKH: what was observed',d['observed']),('Builder: what exists now',d['current']),
      ('Business rules to preserve or add',d['preserve']),('Data and relationships to carry forward',d['data']),
      ('Verification still required',d['verify']),('Acceptance example - proposed, not yet run',d['example'])]
    page_blocks(d['id']+' | '+d['title'],d['route']+'\nSource evidence: '+d['evidence']+'. Full destination comparison: '+', '.join(r['id'] for r in rr[:2])+(' ... '+rr[-1]['id'] if len(rr)>2 else '')+'.',blocks)
for title,blocks in ADDITIONS:page_blocks(title,'Additional requirements, original architecture and proof of migration.',blocks)

page_blocks('How to use the delivered package','Evidence, ownership and honest completion status.',[
('Start with a workflow','Read the domain page, then filter the HTML register by the corresponding original area. Each F-number has a specific preservation requirement and acceptance example, with current Builder status and source confidence. Repeated names remain separate until their targets, permissions and business meaning are verified.'),
('Work from the register','When implementing, link the F-number and data-contract M-number to schema, service, UI route, fixtures, tests and evidence. Record exact source fields/states/formulas as they are verified. A passed example without exception, permission and reconciliation proof is not full parity.'),
('Files','Builder-ERP-267-Function-Comparison.csv: complete destination register. Builder-ERP-42-Area-Map.csv: original area map. Builder-ERP-Data-Contracts.csv: 34 proposed entity/field contracts. comparison.json: structured source for the offline register. Evidence-manifest.json: source files and hashes. The package includes retained legacy screen evidence and fresh review captures.'),
('Unresolved evidence','The remaining work includes forms and rules behind navigation-only destinations, exact source export/schema, custom definitions, real-data volume/quality, all permission/exception transitions and migration reconciliation. Local source-screen inspection can continue without asking the user to list missing functions. A controlled production export is a separate dependency when real data migration begins.'),
('Current conclusion','The comparison covers every recorded navigation destination. It does not certify full behavioural equivalence or a completed migration. Builder ERP must preserve the rich existing logic, close the documented construction gaps and prove the connected workflows before replacement. The existing UI work is a starting shell, not the delivery standard.')])
c.save();(OUT/'report-layout.json').write_text(json.dumps(metrics,indent=2))
assert all(m['bottom']>44 for m in metrics)
print(json.dumps({'pages':page,'rows':len(rows),'root_areas':len(roots),'data_contracts':len(contracts),'statuses':payload['statuses'],'minimum_body_font':min(m['font_size'] for m in metrics if m['font_size']>8.2),'pdf':str(pdf)},indent=2))
