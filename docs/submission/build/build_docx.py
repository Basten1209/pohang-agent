#!/usr/bin/env python3
"""Build the RUN2구룡포 application docx on the official form.

Base package: the previously submitted draft (draft_x/), which is the official form with
붙임1 cleaned/filled and 붙임3 untouched. We keep those parts byte-identical and replace the
붙임2 body (two page-tables in the draft) with one flowing content table rendered from
sections/sec1..5.json (개조식과 설명 문단).
"""
import json, os, re, shutil, sys, zipfile, copy
from xml.sax.saxutils import escape
from lxml import etree
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
# Repo layout: docs/submission/build/build_docx.py ; override any path with env vars for ad-hoc builds.
TEMPLATE_DOCX = os.environ.get('TEMPLATE_DOCX', os.path.join(HERE, 'form-template.docx'))
SECTIONS_DIR = os.environ.get('SECTIONS_DIR', os.path.join(HERE, 'sections'))
ASSETS_DIR = os.environ.get('ASSETS_DIR', os.path.normpath(os.path.join(HERE, '..', '..', 'assets', 'run2-guryongpo')))
OUT_DIR = os.environ.get('BUILD_DIR', os.path.join(HERE, '_build'))
OUT_DOCX = os.environ.get('OUT_DOCX', os.path.normpath(os.path.join(HERE, '..', 'RUN2구룡포-팀명미입력.docx')))
PROJECT_NAME = 'RUN2구룡포'
GUIDANCE_COLORS = {'0059FF', '808080', 'FF0000'}   # blue/gray/red instruction text in the official form

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'
A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture'
NS = {'w': W, 'r': R, 'wp': WP, 'a': A, 'pic': PIC}
WRAP_OPEN = ('<wrap xmlns:w="%s" xmlns:r="%s" xmlns:wp="%s" xmlns:a="%s" xmlns:pic="%s">' % (W, R, WP, A, PIC))

FONT = '맑은 고딕'
MONO = 'Consolas'
BODY_SZ = 22          # 11pt
SMALL_SZ = 20         # 10pt
CODE_SZ = 18          # 9pt
NAVY = '1F3864'
ACCENT = '2E75B6'
HEAD_FILL = 'E2E9F1'
BOX_FILL = 'EEF3F8'
TBL_HEAD_FILL = 'D9E2F3'
CODE_FILL = 'F2F2F2'
LINE = 256            # ~1.07 line spacing (auto)
CELL_INNER_W = 9322   # 9526 table width - 2*102 cell margins (twips)
TABLE_W = 9200

FIGURES = {
    # id: (relationship id, media filename, source path relative to ASSETS_DIR)
    'journey':      ('rIdRun2Figure1', 'run2-journey.png', 'submission/figure-1-journey.png'),
    'architecture': ('rIdRun2Figure2', 'run2-architecture.png', 'submission/figure-2-architecture.png'),
    'sysarch':      ('rIdRun2Figure3', 'run2-sysarch.png', 'application-system-architecture.png'),
    'dataflow':     ('rIdRun2Figure4', 'run2-dataflow.png', 'api-data-flow.png'),
}
FIG_WIDTH_TWIPS = {'journey': 8200, 'architecture': 8400, 'sysarch': 7400, 'dataflow': 7600}
FIG_DOCPR_ID = {'journey': 101, 'architecture': 102, 'sysarch': 103, 'dataflow': 104}


# ---------------------------------------------------------------- run / paragraph helpers

def rpr(bold=False, size=BODY_SZ, color=None, font=None, italic=False, shd=None):
    f = font or FONT
    s = '<w:rFonts w:ascii="%s" w:eastAsia="%s" w:hAnsi="%s" w:cs="%s"/>' % (f, FONT, f, f)
    if bold:
        s += '<w:b/><w:bCs/>'
    if italic:
        s += '<w:i/><w:iCs/>'
    if color:
        s += '<w:color w:val="%s"/>' % color
    s += '<w:sz w:val="%d"/><w:szCs w:val="%d"/>' % (size, size)
    if shd:
        s += '<w:shd w:val="clear" w:color="auto" w:fill="%s"/>' % shd
    return '<w:rPr>%s</w:rPr>' % s


def run(text, **kw):
    if text == '':
        return ''
    return '<w:r>%s<w:t xml:space="preserve">%s</w:t></w:r>' % (rpr(**kw), escape(text))


def tab_run():
    return '<w:r><w:tab/></w:r>'


INLINE_RE = re.compile(r'(\*\*.+?\*\*|`[^`]+`)')


def inline_runs(text, size=BODY_SZ, bold=False, color=None):
    out = []
    for tok in INLINE_RE.split(text):
        if not tok:
            continue
        if tok.startswith('**') and tok.endswith('**') and len(tok) > 4:
            out.append(run(tok[2:-2], size=size, bold=True, color=color))
        elif tok.startswith('`') and tok.endswith('`') and len(tok) > 2:
            out.append(run(tok[1:-1], size=max(size - 1, 16), bold=bold, font=MONO, color='1F4E79'))
        else:
            out.append(run(tok, size=size, bold=bold, color=color))
    return ''.join(out)


def para(runs_xml, left=0, right=0, hanging=0, first=0, before=0, after=40, line=LINE, line_rule='auto',
         jc='left', keep_next=False, keep_lines=False, shd=None, border=None, tabs=None, page_break_before=False):
    p = []
    if keep_next:
        p.append('<w:keepNext/>')
    if keep_lines:
        p.append('<w:keepLines/>')
    if page_break_before:
        p.append('<w:pageBreakBefore/>')
    p.append('<w:widowControl/>')
    if border:
        p.append('<w:pBdr>%s</w:pBdr>' % border)
    if shd:
        p.append('<w:shd w:val="clear" w:color="auto" w:fill="%s"/>' % shd)
    if tabs:
        p.append('<w:tabs>%s</w:tabs>' % ''.join('<w:tab w:val="left" w:pos="%d"/>' % t for t in tabs))
    p.append('<w:spacing w:before="%d" w:after="%d" w:line="%d" w:lineRule="%s"/>' % (before, after, line, line_rule))
    ind = '<w:ind w:left="%d" w:right="%d"' % (left, right)
    if hanging:
        ind += ' w:hanging="%d"' % hanging
    elif first:
        ind += ' w:firstLine="%d"' % first
    ind += '/>'
    p.append(ind)
    p.append('<w:jc w:val="%s"/>' % jc)
    return '<w:p><w:pPr>%s</w:pPr>%s</w:p>' % (''.join(p), runs_xml)


def spacer(after=60, height=100):
    return ('<w:p><w:pPr><w:widowControl/><w:spacing w:before="0" w:after="%d" w:line="%d" w:lineRule="exact"/>'
            '<w:rPr><w:sz w:val="8"/></w:rPr></w:pPr></w:p>' % (after, height))


# ---------------------------------------------------------------- block renderers

BULLET = {
    1: dict(marker='□', left=284, hanging=284, before=120, after=30, bold=True, size=BODY_SZ, keep_next=True),
    2: dict(marker='○', left=567, hanging=283, before=0, after=24, bold=False, size=BODY_SZ, keep_next=False),
    3: dict(marker='-', left=851, hanging=284, before=0, after=16, bold=False, size=BODY_SZ, keep_next=False),
    4: dict(marker='·', left=1134, hanging=283, before=0, after=16, bold=False, size=BODY_SZ, keep_next=False),
}


def render_section_heading(number, title, first):
    txt = '%s. %s' % (number, title)
    return para(run(txt, bold=True, size=26, color=NAVY), left=80, before=60 if first else 200, after=90,
                keep_next=True, keep_lines=True, shd=HEAD_FILL,
                border='<w:bottom w:val="single" w:sz="8" w:space="1" w:color="%s"/>' % ACCENT)


def render_p(block, ctx):
    lv = block['level']
    st = BULLET[lv]
    runs = run(st['marker'], bold=st['bold'], size=st['size']) + tab_run() + inline_runs(block['text'], size=st['size'], bold=st['bold'])
    keep_next = st['keep_next'] or ctx.get('force_keep_next', False) or block.get('keep_next', False)
    compact = block.get('compact', False)
    return para(runs, left=st['left'], hanging=st['hanging'], before=st['before'],
                after=0 if compact else st['after'], line=240 if compact else LINE,
                keep_next=keep_next, tabs=[st['left']])


def render_prose(block, ctx):
    # Align with the level-2 bullet marker, without a marker or hanging indent.
    # Long explanatory paragraphs may flow across pages with widow control.
    return para(inline_runs(block['text']), left=284, before=0, after=80,
                keep_next=block.get('keep_next', False) or ctx.get('force_keep_next', False))


def render_note(block, ctx):
    runs = run('※', size=SMALL_SZ, color='404040') + tab_run() + inline_runs(block['text'], size=SMALL_SZ, color='404040')
    return para(runs, left=851, hanging=284, before=6, after=36, keep_next=False, tabs=[851])


def render_box(block, ctx):
    runs = inline_runs(block['text'], size=BODY_SZ, bold=True, color=NAVY)
    return para(runs, left=200, right=120, before=70, after=110, shd=BOX_FILL,
                border='<w:left w:val="single" w:sz="24" w:space="6" w:color="%s"/>' % ACCENT, keep_next=True)


def cell_paras(text, jc='left', bold=False, size=19):
    # allow manual line splitting inside cells with ' / '? keep simple: one paragraph
    return para(inline_runs(text, size=size, bold=bold), before=0, after=0, line=240, jc=jc)


def render_table(block, ctx):
    ctx['table_no'] += 1
    n = ctx['table_no']
    hdr = block['header']
    rows = block['rows']
    widths = block['widths']
    align = block.get('align') or ['l'] * len(hdr)
    cols = [int(round(TABLE_W * w / 100.0)) for w in widths]
    cols[-1] += TABLE_W - sum(cols)
    borders = ''.join('<w:%s w:val="single" w:sz="4" w:space="0" w:color="7F7F7F"/>' % s
                      for s in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'))
    tbl = ['<w:tbl>']
    tbl.append('<w:tblPr><w:tblW w:w="%d" w:type="dxa"/><w:jc w:val="center"/><w:tblBorders>%s</w:tblBorders>'
               '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="30" w:type="dxa"/><w:left w:w="70" w:type="dxa"/>'
               '<w:bottom w:w="30" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar>'
               '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>'
               % (TABLE_W, borders))
    tbl.append('<w:tblGrid>%s</w:tblGrid>' % ''.join('<w:gridCol w:w="%d"/>' % c for c in cols))

    def tc(text, w, jc, bold=False, fill=None):
        tcpr = '<w:tcW w:w="%d" w:type="dxa"/>' % w
        if fill:
            tcpr += '<w:shd w:val="clear" w:color="auto" w:fill="%s"/>' % fill
        tcpr += '<w:vAlign w:val="center"/>'
        return '<w:tc><w:tcPr>%s</w:tcPr>%s</w:tc>' % (tcpr, cell_paras(text, jc=jc, bold=bold))

    tbl.append('<w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>%s</w:tr>' %
               ''.join(tc(h, cols[i], 'center', bold=True, fill=TBL_HEAD_FILL) for i, h in enumerate(hdr)))
    for r in rows:
        tbl.append('<w:tr><w:trPr><w:cantSplit/></w:trPr>%s</w:tr>' %
                   ''.join(tc(c, cols[i], 'center' if align[i] == 'c' else 'left') for i, c in enumerate(r)))
    tbl.append('</w:tbl>')
    caption = para(run('[표 %d] ' % n, bold=True, size=SMALL_SZ, color=NAVY) + inline_runs(block['caption'], size=SMALL_SZ, bold=True, color=NAVY),
                   left=80, before=90, after=40, keep_next=True)
    return caption + ''.join(tbl) + spacer(after=60)


def render_figure(block, ctx):
    ctx['figure_no'] += 1
    n = ctx['figure_no']
    fid = block['id']
    rid, fname, _ = FIGURES[fid]
    pw, ph = ctx['fig_px'][fid]
    w_tw = FIG_WIDTH_TWIPS[fid]
    cx = w_tw * 635
    cy = int(round(cx * ph / float(pw)))
    docpr = FIG_DOCPR_ID[fid]
    descr = escape(block['caption'])
    drawing = (
        '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="%d" cy="%d"/>'
        '<wp:docPr id="%d" name="Figure %d" descr="%s"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>'
        '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>'
        '<pic:nvPicPr><pic:cNvPr id="%d" name="Figure %d"/><pic:cNvPicPr/></pic:nvPicPr>'
        '<pic:blipFill><a:blip r:embed="%s"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
        '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="%d" cy="%d"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
        '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'
        % (cx, cy, docpr, docpr, descr, docpr, docpr, rid, cx, cy))
    img_p = para(drawing, before=80, after=30, jc='center', keep_next=True, line=240)
    cap = para(run('[그림 %d] ' % n, bold=True, size=SMALL_SZ, color=NAVY) + inline_runs(block['caption'], size=SMALL_SZ, color='404040'),
               before=0, after=100, jc='center')
    return img_p + cap


def render_code(block, ctx):
    lines = block['lines']
    out = []
    bdr = '<w:left w:val="single" w:sz="12" w:space="4" w:color="BFBFBF"/>'
    title = block.get('title')
    total = len(lines) + (1 if title else 0)
    idx = 0
    if title:
        out.append(para(run(title, bold=True, size=CODE_SZ + 1, color=NAVY), left=420, right=420, before=70, after=0,
                        line=240, shd=CODE_FILL, border=bdr, keep_next=True, keep_lines=True))
        idx += 1
    for i, ln in enumerate(lines):
        last = (i == len(lines) - 1)
        out.append(para(run(ln, size=CODE_SZ, font=MONO, color='1F1F1F'), left=420, right=420,
                        before=(70 if (idx == 0) else 0), after=(70 if last else 0), line=240, shd=CODE_FILL,
                        border=bdr, keep_next=not last, keep_lines=True))
        idx += 1
    return ''.join(out) + spacer(after=60)


RENDER = {'p': render_p, 'prose': render_prose, 'note': render_note, 'box': render_box, 'table': render_table, 'figure': render_figure, 'code': render_code}


def render_sections(sections, ctx):
    out = []
    for si, sec in enumerate(sections):
        out.append(render_section_heading(sec['number'], sec['title'], first=(si == 0)))
        blocks = sec['blocks']
        for bi, b in enumerate(blocks):
            # keep a bullet with the table/figure/code that immediately follows it
            nxt = blocks[bi + 1]['t'] if bi + 1 < len(blocks) else None
            ctx['force_keep_next'] = nxt in ('table', 'figure', 'code', 'box')
            out.append(RENDER[b['t']](b, ctx))
        ctx['force_keep_next'] = False
    out.append(spacer(after=0))
    return ''.join(out)


# ---------------------------------------------------------------- document assembly

def parse_fragment(xml):
    root = etree.fromstring(WRAP_OPEN + xml + '</wrap>')
    return list(root)


def strip_guidance(container):
    """Remove blue/gray/red instruction runs inside `container` and paragraphs emptied by that."""
    removed = 0
    for r in list(container.iter('{%s}r' % W)):
        col = r.find('w:rPr/w:color', NS)
        if col is not None and col.get('{%s}val' % W, '').upper() in GUIDANCE_COLORS:
            r.getparent().remove(r)
            removed += 1
    for p in list(container.iter('{%s}p' % W)):
        has_content = any(etree.QName(c).localname in ('r', 'hyperlink', 'fldSimple', 'sdt') for c in p)
        if has_content:
            continue
        parent = p.getparent()
        siblings = [c for c in parent if etree.QName(c).localname == 'p']
        if etree.QName(parent).localname == 'tc' and len(siblings) <= 1:
            continue
        if etree.QName(parent).localname == 'tc' and p is siblings[-1] and len(siblings) > 1:
            # keep last paragraph if all others are also empty? simpler: only drop when another non-empty exists
            pass
        parent.remove(p)
    return removed


def fill_project_name(body):
    filled = 0
    for tc in body.iter('{%s}tc' % W):
        if ''.join(tc.itertext()).strip().replace(' ', '') == '프로젝트명':
            val = tc.getnext()
            if val is None or etree.QName(val).localname != 'tc':
                continue
            p = val.find('w:p', NS)
            if p is None:
                continue
            if ''.join(p.itertext()).strip():
                continue
            # normalise: no first-line indent, then add the run
            ppr = p.find('w:pPr', NS)
            if ppr is not None:
                ind = ppr.find('w:ind', NS)
                if ind is not None:
                    ppr.remove(ind)
            p.append(parse_fragment(run(PROJECT_NAME, bold=True, size=22))[0])
            filled += 1
    return filled


def main():
    sections = []
    for n in range(1, 6):
        sections.append(json.load(open(os.path.join(SECTIONS_DIR, 'sec%d.json' % n), encoding='utf-8')))

    fig_px = {}
    for fid, (rid, fname, src) in FIGURES.items():
        with Image.open(os.path.join(ASSETS_DIR, src)) as im:
            fig_px[fid] = im.size
    ctx = {'table_no': 0, 'figure_no': 0, 'fig_px': fig_px}
    content_nodes = parse_fragment(render_sections(sections, ctx))

    # --- unpack the official form
    if os.path.exists(OUT_DIR):
        shutil.rmtree(OUT_DIR)
    with zipfile.ZipFile(TEMPLATE_DOCX) as z:
        z.extractall(OUT_DIR)
    doc_path = os.path.join(OUT_DIR, 'word', 'document.xml')
    tree = etree.parse(doc_path)
    root = tree.getroot()
    body = root.find('w:body', NS)
    kids = list(body)

    def text_of(el):
        return ''.join(el.itertext())
    def is_tbl(el):
        return etree.QName(el).localname == 'tbl'
    idx_b2 = next(i for i, el in enumerate(kids) if is_tbl(el) and text_of(el).startswith('붙임 2'))
    idx_team = next(i for i, el in enumerate(kids) if i > idx_b2 and is_tbl(el) and '프로젝트 명' in text_of(el))
    idx_b3 = next(i for i, el in enumerate(kids) if is_tbl(el) and text_of(el).startswith('붙임 3'))
    body_sect = body.find('w:sectPr', NS)
    pgsz = re.sub(r'\sxmlns:\w+="[^"]+"', '', etree.tostring(body_sect.find('w:pgSz', NS), encoding='unicode'))
    pgmar = re.sub(r'\sxmlns:\w+="[^"]+"', '', etree.tostring(body_sect.find('w:pgMar', NS), encoding='unicode'))
    footer_ref = '<w:footerReference w:type="default" r:id="rIdFooter1"/>'

    def sect_break_para(borders):
        pgb = ''
        if borders:
            pgb = ('<w:pgBorders w:offsetFrom="text">'
                   + ''.join('<w:%s w:val="single" w:sz="8" w:space="10" w:color="000000"/>' % s for s in ('top', 'left', 'bottom', 'right'))
                   + '</w:pgBorders>')
        sect = '<w:sectPr>%s<w:type w:val="nextPage"/>%s%s%s<w:cols w:space="0"/></w:sectPr>' % (footer_ref, pgsz, pgmar, pgb)
        return ('<w:p><w:pPr><w:widowControl/><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/>'
                '<w:rPr><w:sz w:val="2"/></w:rPr>%s</w:pPr></w:p>' % sect)

    # section 1 (붙임1): the paragraph right before the 붙임2 header becomes a section break (new page)
    idx_pb1 = idx_b2 - 1
    assert etree.QName(kids[idx_pb1]).localname == 'p'
    body.replace(kids[idx_pb1], parse_fragment(sect_break_para(borders=False))[0])

    # section 2 (붙임2): keep header/title/team tables (+ the empty paragraph after the team table);
    # drop red instructions, the guideline box, the page break; insert content + bordered section break
    keep_upto = idx_team
    if etree.QName(kids[idx_team + 1]).localname == 'p' and not text_of(kids[idx_team + 1]).strip():
        keep_upto = idx_team + 1
    for el in kids[keep_upto + 1:idx_b3]:
        body.remove(el)
    insert_at = list(body).index(kids[keep_upto]) + 1
    for off, node in enumerate(content_nodes + parse_fragment(sect_break_para(borders=True))):
        body.insert(insert_at + off, node)

    # section 3 (붙임3): body-level sectPr gets the footer reference (first child)
    fr = etree.Element('{%s}footerReference' % W)
    fr.set('{%s}type' % W, 'default')
    fr.set('{%s}id' % R, 'rIdFooter1')
    body_sect.insert(0, fr)

    # 붙임1 clean-up + project name
    b1_tables = [el for el in list(body)[:list(body).index(kids[idx_b2])] if is_tbl(el)]
    removed = sum(strip_guidance(t) for t in b1_tables)
    filled = fill_project_name(body)
    tree.write(doc_path, xml_declaration=True, encoding='UTF-8', standalone=True)

    # --- media
    media_dir = os.path.join(OUT_DIR, 'word', 'media')
    os.makedirs(media_dir, exist_ok=True)
    for fid, (rid, fname, src) in FIGURES.items():
        shutil.copy(os.path.join(ASSETS_DIR, src), os.path.join(media_dir, fname))

    # --- relationships
    PR = 'http://schemas.openxmlformats.org/package/2006/relationships'
    rels_path = os.path.join(OUT_DIR, 'word', '_rels', 'document.xml.rels')
    rtree = etree.parse(rels_path)
    rroot = rtree.getroot()
    existing = {rel.get('Id') for rel in rroot}
    for fid, (rid, fname, src) in FIGURES.items():
        if rid not in existing:
            e = etree.SubElement(rroot, '{%s}Relationship' % PR)
            e.set('Id', rid); e.set('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image'); e.set('Target', 'media/' + fname)
    if 'rIdFooter1' not in existing:
        e = etree.SubElement(rroot, '{%s}Relationship' % PR)
        e.set('Id', 'rIdFooter1'); e.set('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer'); e.set('Target', 'footer1.xml')
    rtree.write(rels_path, xml_declaration=True, encoding='UTF-8', standalone=True)

    # --- footer part (centred page number)
    g = dict(size=18, color='595959')
    footer = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
              '<w:ftr xmlns:w="%s" xmlns:r="%s"><w:p><w:pPr><w:widowControl/><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>'
              '%s<w:r>%s<w:fldChar w:fldCharType="begin"/></w:r><w:r>%s<w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>'
              '<w:r>%s<w:fldChar w:fldCharType="separate"/></w:r><w:r>%s<w:t>1</w:t></w:r><w:r>%s<w:fldChar w:fldCharType="end"/></w:r>%s</w:p></w:ftr>'
              % (W, R, run('- ', **g), rpr(**g), rpr(**g), rpr(**g), rpr(**g), rpr(**g), run(' -', **g)))
    open(os.path.join(OUT_DIR, 'word', 'footer1.xml'), 'w', encoding='utf-8').write(footer)

    # --- content types
    CT = 'http://schemas.openxmlformats.org/package/2006/content-types'
    ct_path = os.path.join(OUT_DIR, '[Content_Types].xml')
    ctree = etree.parse(ct_path)
    croot = ctree.getroot()
    if not any(e.get('Extension', '').lower() == 'png' for e in croot if etree.QName(e).localname == 'Default'):
        d = etree.SubElement(croot, '{%s}Default' % CT); d.set('Extension', 'png'); d.set('ContentType', 'image/png')
    if not any(e.get('PartName') == '/word/footer1.xml' for e in croot):
        o = etree.SubElement(croot, '{%s}Override' % CT); o.set('PartName', '/word/footer1.xml')
        o.set('ContentType', 'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml')
    ctree.write(ct_path, xml_declaration=True, encoding='UTF-8', standalone=True)

    # --- zip (fixed timestamps; [Content_Types].xml first)
    os.makedirs(os.path.dirname(OUT_DOCX), exist_ok=True)
    if os.path.exists(OUT_DOCX):
        os.remove(OUT_DOCX)

    def add(z, full, arc):
        zi = zipfile.ZipInfo(arc, date_time=(2026, 9, 11, 0, 0, 0))
        zi.compress_type = zipfile.ZIP_DEFLATED
        zi.external_attr = 0o644 << 16
        with open(full, 'rb') as fh:
            z.writestr(zi, fh.read())
    with zipfile.ZipFile(OUT_DOCX, 'w', zipfile.ZIP_DEFLATED) as z:
        add(z, ct_path, '[Content_Types].xml')
        for dp, dn, fn in sorted(os.walk(OUT_DIR)):
            for f in sorted(fn):
                full = os.path.join(dp, f)
                arc = os.path.relpath(full, OUT_DIR).replace(os.sep, '/')
                if arc == '[Content_Types].xml':
                    continue
                add(z, full, arc)
    print('wrote %s | tables %d | figures %d | guidance runs removed %d | project name filled %d'
          % (OUT_DOCX, ctx['table_no'], ctx['figure_no'], removed, filled))


if __name__ == '__main__':
    main()
