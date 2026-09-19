#!/usr/bin/env python3
"""
Convert a biblestudyoffer-style lesson .docx into an Ekklē study JSON.

Usage: python3 scripts/convert_study.py <lesson.docx> [--inline-image] > study.json

Output shape:
{
  "number": 1,
  "title": "The Logic of Love",
  "tagline": "Discover ...",           # the Discover lead line, if present
  "blanks": 15,                         # count of fill-in fields
  "pages": [ { "page_number": 1, "blocks": [ {block}... ] } ... ]
}
Blocks: {"t":"h","text":..}     heading / section label
        {"t":"p","text":..}     paragraph (blanks encoded as the token below)
        {"t":"img","src":..}    image (data URL when --inline-image, else name)

Structure notes (learned from the sample doc):
  * Logical lines are separated by <w:br/> inside paragraphs, NOT by paragraph
    boundaries — the whole page can live in one <w:p>. We flatten to lines.
  * A line "Page N of M" is a FOOTER that closes page N. Content after the last
    such marker, up to "Submit Answers", is the final page.
  * Blanks are runs of 3+ underscores. This lesson ships no answer key, so each
    blank becomes an empty {{}} token: the reader renders a fill-in field, and
    "Submit answers" enables once every field has a value (any value — it need
    not be correct). If a future doc pairs answers, put them inside the braces.
"""
import sys, re, os, json, base64, zipfile
import xml.etree.ElementTree as ET

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"

BLANK = "{{}}"
SECTIONS = {"discover", "connect", "experience"}
PAGE_RE = re.compile(r"^\s*Page\s+(\d+)\s+of\s+(\d+)\s*$", re.I)
SMALL = {"of", "the", "and", "a", "an", "in", "to", "for", "is", "on"}


def q(tag, nsuri=W):
    return f"{{{nsuri}}}{tag}"


def para_lines(p):
    """Flatten a <w:p> into logical lines, splitting on <w:br/>/<w:cr>."""
    lines = [""]
    for r in p.findall(q("r")):
        for child in r:
            tag = child.tag.split("}")[-1]
            if tag == "t":
                lines[-1] += child.text or ""
            elif tag in ("br", "cr"):
                lines.append("")
    return lines


def para_image_rid(p):
    blip = p.find(f".//{q('blip', A)}")
    return blip.get(q("embed", R)) if blip is not None else None


def is_heading(line):
    t = line.strip().rstrip(":")
    if not t:
        return False
    if t.lower() in SECTIONS:
        return True
    # ALLCAPS subheading like "WHY THE BIBLE?" or "A GOD WHO KNOWS AND CAN BE KNOWN"
    if len(t) <= 60 and any(c.isalpha() for c in t) and not any(c.islower() for c in t):
        return True
    return False


def titlecase(s):
    words = s.split()
    out = []
    for i, w in enumerate(words):
        lw = w.lower()
        out.append(lw if (i and lw in SMALL) else lw.capitalize())
    return " ".join(out)


def main():
    path = sys.argv[1]
    inline = "--inline-image" in sys.argv

    z = zipfile.ZipFile(path)
    doc = ET.fromstring(z.read("word/document.xml"))
    rels = ET.fromstring(z.read("word/_rels/document.xml.rels"))
    rid_to_target = {r.get("Id"): r.get("Target") for r in rels}

    # Flatten body into an ordered stream of ("img", rid) / ("line", text).
    stream = []
    for p in doc.find(q("body")).findall(q("p")):
        rid = para_image_rid(p)
        if rid:
            stream.append(("img", rid))
        for line in para_lines(p):
            if line.strip():
                stream.append(("line", line.strip()))

    number, title, tagline = None, None, None
    pages, cur, page_no = [], [], 1
    blanks = 0
    seen_section = False

    def img_block(rid):
        src = rid_to_target.get(rid, "")
        media = src if src.startswith("word/") else "word/" + src
        if inline:
            data = z.read(media)
            b64 = base64.b64encode(data).decode()
            ext = os.path.splitext(src)[1].lstrip(".").lower() or "png"
            return {"t": "img", "src": f"data:image/{ext};base64,{b64}"}
        return {"t": "img", "src": os.path.basename(src)}

    for kind, payload in stream:
        if kind == "img":
            cur.append(img_block(payload))
            continue
        text = payload

        # "Submit Answers" ends the content stream.
        if text.lower().startswith("submit answers"):
            break

        # Page footer closes the current page.
        m = PAGE_RE.match(text)
        if m:
            pages.append({"page_number": int(m.group(1)), "blocks": cur})
            cur = []
            continue

        # Title line: "1  THE LOGIC OF LOVE"
        if number is None:
            hm = re.match(r"^(\d+)\s{1,}(.+)$", text)
            if hm and not any(c.islower() for c in hm.group(2)):
                number = int(hm.group(1))
                title = titlecase(hm.group(2).strip())
                # Title is shown in the reader header — don't repeat it as a block.
                continue

        # First non-heading line right after the "Discover" label is the tagline.
        if tagline is None and seen_section and not is_heading(text):
            tagline = text

        def repl(_m):
            nonlocal blanks
            blanks += 1
            return BLANK

        text = re.sub(r"_{3,}", repl, text)

        if is_heading(payload):
            if payload.strip().lower() in SECTIONS:
                seen_section = True
            cur.append({"t": "h", "text": text})
        else:
            cur.append({"t": "p", "text": text})

    if cur:
        # trailing page (final page has no "Page N of M" footer)
        nextno = (pages[-1]["page_number"] + 1) if pages else 1
        pages.append({"page_number": nextno, "blocks": cur})

    print(json.dumps({
        "number": number,
        "title": title,
        "tagline": tagline,
        "blanks": blanks,
        "pages": pages,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
