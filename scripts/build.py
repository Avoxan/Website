#!/usr/bin/env python3
"""
Avoxan site build.

Every page's own content lives in src/, mirroring the URL structure:

    src/index.html            ->  index.html
    src/services.html         ->  services.html
    src/work/index.html       ->  work/index.html
    src/blog/<post>.html      ->  blog/<post>.html

A source file starts with a JSON front matter block inside an HTML comment,
then the page body (everything that goes inside <main>):

    <!--page
    {
      "title": "Services | ...",
      "description": "...",
      "canonical": "/services",
      "nav": "services",
      "css": ["pages/services.css"],
      "js": ["pages/services.js"],
      "schema": [ {...}, {...} ],
      "faq_schema": "#faq"      (optional: FAQPage built from <details> Q&As)
    }
    -->
    <section>...</section>
    <!--after-footer-->            (optional: markup placed after the footer)
    <!--include call-deck.html-->  (pulls in src/_partials/call-deck.html)

The build wraps it in the shared <head>, header, mobile menu and footer, and
writes the finished, plain HTML file to the repo root. Hosting does not
change: Cloudflare Pages still serves static files with no build step.

    python3 scripts/build.py          # build every page
    python3 scripts/build.py services # build pages whose path contains "services"

Nothing in src/ is meant to be served: _headers marks it noindex and
robots.txt disallows it.
"""
import json, os, re, sys, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
SITE = "https://avoxan.com"
CSS_V = "3"

NAV = [
    ("work", "/work/", "Work"),
    ("services", "/services", "Services"),
    ("ai", "/ai-receptionist", "AI receptionist"),
    ("pricing", "/pricing", "Pricing"),
    ("process", "/process", "Process"),
    ("journal", "/blog/", "Journal"),
]

ORG = {
    "@type": ["Organization", "ProfessionalService"],
    "@id": SITE + "/#org",
    "name": "Avoxan",
    "legalName": "Akarshan Digital LLC",
    "url": SITE + "/",
    "logo": SITE + "/avoxan-logo-512.png",
    "email": "hello@avoxan.com",
    "address": {"@type": "PostalAddress", "addressLocality": "Houston", "addressRegion": "TX", "addressCountry": "US"},
    "areaServed": [{"@type": "City", "name": "Houston"}, {"@type": "State", "name": "Texas"}, "US"],
}

HEAD_SCRIPT = """<script>
  /* Runs before paint: JS-only styles apply once we know JS runs, motion only
     when the visitor hasn't asked for less. If the main script never loads,
     the page falls back to its complete no-JS state after 3s. */
  (function(d){d.classList.remove('no-js');d.classList.add('js');
    try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)d.classList.add('motion')}catch(e){}
    setTimeout(function(){if(!window.__avxReady){d.classList.remove('js','motion');d.classList.add('no-js')}},3000);
  })(document.documentElement);
</script>"""


def esc(s):
    return html.escape(s, quote=True)


def header(nav_key):
    links = "\n".join(
        '      <a href="%s"%s>%s</a>' % (href, ' aria-current="page"' if key == nav_key else "", label)
        for key, href, label in NAV
    )
    sheet = "\n".join('    <a href="%s">%s</a>' % (href, label) for key, href, label in NAV)
    return f"""<a class="skip" href="#main">Skip to content</a>

<header class="hdr" id="hdr">
  <div class="wrap hdr__in">
    <a class="brand" href="/" aria-label="Avoxan, home">
      <img src="/avoxan-logo.svg" alt="" width="22" height="22">Avoxan
    </a>
    <nav class="nav" aria-label="Main">
{links}
    </nav>
    <a class="btn hdr__cta" href="/contact" data-cta="header">Start a project</a>
    <button class="hdr__menu" id="menuBtn" aria-expanded="false" aria-controls="sheet"><span></span><span></span><span class="sr-only">Menu</span></button>
  </div>
</header>

<div class="sheet" id="sheet" aria-hidden="true">
  <nav aria-label="Mobile">
{sheet}
    <a href="/contact">Start a project</a>
  </nav>
  <div class="sheet__foot mono"><span>hello@avoxan.com</span><span>Houston, TX</span></div>
</div>
"""


FOOTER = """<footer class="ftr" data-palette="studio">
  <div class="wrap">
    <div class="ftr__grid">
      <div class="ftr__about">
        <a class="brand" href="/"><img src="/avoxan-logo.svg" alt="" width="22" height="22">Avoxan</a>
        <p style="margin-top:18px">A Houston web design and development studio for owner-led businesses that refuse to look small.</p>
        <p class="ftr__nap mono">Houston, Texas · <a href="mailto:hello@avoxan.com">hello@avoxan.com</a></p>
      </div>
      <div>
        <h4 class="mono">Studio</h4>
        <ul><li><a href="/work/">Work</a></li><li><a href="/services">Services</a></li><li><a href="/process">Process</a></li><li><a href="/pricing">Pricing</a></li><li><a href="/faq">FAQ</a></li><li><a href="/contact">Contact</a></li></ul>
      </div>
      <div>
        <h4 class="mono">AI receptionist</h4>
        <ul><li><a href="/ai-receptionist">How it works</a></li><li><a href="/ai-receptionist-plumbers">For plumbers</a></li><li><a href="/houston-med-spas">For med spas</a></li><li><a href="/pricing#ai">Plans from $97</a></li></ul>
      </div>
      <div>
        <h4 class="mono">Journal</h4>
        <ul><li><a href="/blog/website-cost-2026">Website cost in 2026</a></li><li><a href="/blog/local-seo-checklist">Local SEO checklist</a></li><li><a href="/blog/what-is-an-ai-receptionist">What is an AI receptionist?</a></li><li><a href="/blog/">All journal entries</a></li></ul>
      </div>
    </div>
  </div>
  <div class="ftr__word" aria-hidden="true">Avoxan</div>
  <div class="wrap ftr__legal">
    <span>© 2026 Akarshan Digital LLC. Avoxan is a trading name of Akarshan Digital LLC.</span>
    <span><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · Houston, Texas</span>
  </div>
</footer>
"""


PARTIALS = os.path.join(SRC, "_partials")


def include(m):
    return open(os.path.join(PARTIALS, m.group(1)), encoding="utf-8").read().rstrip("\n")


def parse(path):
    raw = open(path, encoding="utf-8").read()
    raw = re.sub(r"<!--include ([\w.-]+)-->", include, raw)
    m = re.match(r"\s*<!--page\s*(\{.*?\})\s*-->\s*", raw, re.S)
    if not m:
        raise SystemExit(f"{path}: missing <!--page {{...}} --> front matter")
    meta = json.loads(m.group(1))
    body = raw[m.end():]
    after = ""
    if "<!--after-footer-->" in body:
        body, after = body.split("<!--after-footer-->", 1)
    return meta, body.strip("\n"), after.strip("\n")


def strip_tags(s):
    s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def faq_schema(body, at_id):
    """Build FAQPage schema from every <details><summary>Q</summary>A</details>
    in the body, so the visible answers and the structured data never drift."""
    qs = []
    for q, a in re.findall(r"<details[^>]*>\s*<summary[^>]*>(.*?)</summary>(.*?)</details>", body, re.S):
        qs.append({"@type": "Question", "name": strip_tags(q),
                   "acceptedAnswer": {"@type": "Answer", "text": strip_tags(a)}})
    return {"@type": "FAQPage", "@id": at_id, "mainEntity": qs}


def render(meta, body, after):
    title = meta["title"]
    desc = meta["description"]
    canonical = SITE + meta.get("canonical", "/")
    og_title = meta.get("og_title", title)
    og_desc = meta.get("og_description", desc)
    og_image = meta.get("og_image", SITE + "/og-image.png")
    robots = meta.get("robots", "index, follow, max-image-preview:large, max-snippet:-1")
    theme = meta.get("theme_color", "#0D0B09")
    og_type = meta.get("og_type", "website")

    head = [
        '<!DOCTYPE html>',
        '<html lang="en-US" class="no-js">',
        '<head>',
        '<meta charset="UTF-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">',
        '',
        f'<title>{esc(title)}</title>',
        f'<meta name="description" content="{esc(desc)}">',
        '<meta name="author" content="Akarshan Digital LLC">',
        f'<meta name="robots" content="{esc(robots)}">',
        f'<link rel="canonical" href="{esc(canonical)}">',
        '<meta name="geo.region" content="US-TX">',
        '<meta name="geo.placename" content="Houston">',
        f'<meta name="theme-color" content="{esc(theme)}">',
        f'<meta name="color-scheme" content="{esc(meta.get("color_scheme", "dark"))}">',
        '<meta name="format-detection" content="telephone=no">',
        '',
        '<link rel="icon" type="image/svg+xml" href="/avoxan-logo.svg">',
        '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">',
        '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">',
        '<link rel="shortcut icon" href="/favicon.ico">',
        '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
        '<link rel="manifest" href="/site.webmanifest">',
        '',
        f'<meta property="og:type" content="{esc(og_type)}">',
        '<meta property="og:site_name" content="Avoxan">',
        '<meta property="og:locale" content="en_US">',
        f'<meta property="og:title" content="{esc(og_title)}">',
        f'<meta property="og:description" content="{esc(og_desc)}">',
        f'<meta property="og:url" content="{esc(canonical)}">',
        f'<meta property="og:image" content="{esc(og_image)}">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{esc(og_title)}">',
        f'<meta name="twitter:description" content="{esc(og_desc)}">',
        f'<meta name="twitter:image" content="{esc(og_image)}">',
    ]
    art = meta.get("article")
    if art:
        head.append(f'<meta property="article:published_time" content="{esc(art["published"])}">')
        head.append(f'<meta property="article:modified_time" content="{esc(art.get("modified", art["published"]))}">')
    head += ['', HEAD_SCRIPT,
             '<link rel="preload" href="/fonts/instrument-serif-latin.woff2" as="font" type="font/woff2" crossorigin>',
             '<link rel="preload" href="/fonts/instrument-serif-italic-latin.woff2" as="font" type="font/woff2" crossorigin>']
    for p in meta.get("preload", []):
        t = f' type="{esc(p["type"])}"' if p.get("type") else ""
        head.append(f'<link rel="preload" href="{esc(p["href"])}" as="{esc(p["as"])}"{t}>')
    head.append(f'<link rel="stylesheet" href="/css/avoxan-studio.css?v={CSS_V}">')
    for c in meta.get("css", []):
        head.append(f'<link rel="stylesheet" href="/css/{esc(c)}?v={CSS_V}">')

    graph = list(meta.get("schema", []))
    if meta.get("faq_schema"):
        graph.append(faq_schema(body, canonical + meta["faq_schema"]))
    if meta.get("org", True):
        graph.insert(0, ORG)
    crumbs = meta.get("breadcrumb")
    if crumbs:
        items = [{"@type": "ListItem", "position": i + 1, "name": n, "item": SITE + u} for i, (n, u) in enumerate(crumbs)]
        graph.append({"@type": "BreadcrumbList", "@id": canonical + "#breadcrumb", "itemListElement": items})
    if graph:
        head.append('<script type="application/ld+json">')
        head.append(json.dumps({"@context": "https://schema.org", "@graph": graph}, indent=1, ensure_ascii=False))
        head.append('</script>')
    head.append('</head>')

    scripts = [f'<script src="/js/avoxan-studio.js?v={CSS_V}" defer></script>']
    for j in meta.get("js", []):
        scripts.append(f'<script src="/js/{esc(j)}?v={CSS_V}" defer></script>')
    if meta.get("booking"):
        scripts.append('<script src="/js/avoxan-booking.js" defer></script>')
    if meta.get("chat", True):
        scripts.append(f'<script src="/js/avoxan-chat.js?v={CSS_V}" defer></script>')
    scripts.append('<script src="/js/avoxan-analytics.js" defer></script>')

    body_cls = f' class="{esc(meta["body_class"])}"' if meta.get("body_class") else ""
    out = "\n".join(head) + f"\n<body{body_cls}>\n" + header(meta.get("nav", "")) + \
        '\n<main id="main">\n\n' + body + "\n\n</main>\n\n" + FOOTER + \
        ("\n" + after + "\n" if after else "") + "\n" + "\n".join(scripts) + "\n</body>\n</html>\n"
    return out


def main():
    filt = sys.argv[1] if len(sys.argv) > 1 else ""
    n = 0
    for dirpath, dirs, files in os.walk(SRC):
        dirs[:] = [d for d in dirs if not d.startswith("_")]  # _partials etc. are not pages
        for f in sorted(files):
            if not f.endswith(".html"):
                continue
            src = os.path.join(dirpath, f)
            rel = os.path.relpath(src, SRC)
            if filt and filt not in rel:
                continue
            meta, body, after = parse(src)
            out = os.path.join(ROOT, rel)
            os.makedirs(os.path.dirname(out), exist_ok=True)
            open(out, "w", encoding="utf-8").write(render(meta, body, after))
            n += 1
            print("built", rel)
    print(f"{n} page(s)")


if __name__ == "__main__":
    main()
