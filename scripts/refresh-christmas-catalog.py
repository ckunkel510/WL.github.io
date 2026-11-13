import concurrent.futures, html, json, re, urllib.request
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse, parse_qs

ROOT='https://webtrack.woodsonlumber.com/Products.aspx?pl1=4647&pg=4649&sort=StockClassSort&direction=asc&itemsPerPage=48&pageIndex=0'
BASE='https://webtrack.woodsonlumber.com'
class CatalogParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.products=[]; self.groups=[]; self.stack=[]; self.product=None; self.anchor=None; self.text=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs); self.stack.append((tag,a)) if tag not in ['img','input','meta','br','link','hr'] else None
        if tag=='table' and a.get('id')=='ProductCard':self.product={'productId':'','productCode':''}
        if tag=='a' and a.get('id','').endswith('ProductGroupLinkHeader'):
            u=urljoin(BASE,a.get('href','')); pg=parse_qs(urlparse(u).query).get('pg',[''])[0]
            self.anchor={'id':pg,'href':u,'name':''}
        if tag=='a' and self.product:
            pg=parse_qs(urlparse(html.unescape(a.get('href',''))).query).get('pid',[''])[0]
            if pg:self.product['productId']=pg
    def handle_endtag(self,tag):
        if tag=='a' and self.anchor:
            self.anchor['name']=re.sub(r'\s+',' ',self.anchor['name']).strip(); self.groups.append(self.anchor);self.anchor=None
        if tag=='table' and self.product:
            if self.product['productId']:self.products.append(self.product)
            self.product=None
        for i in range(len(self.stack)-1,-1,-1):
            if self.stack[i][0]==tag:self.stack=self.stack[:i];break
    def handle_data(self,s):
        self.text.append(s)
        if self.anchor:self.anchor['name']+=s
        if self.product and any(a.get('id')=='ProductCodeRow' for _,a in self.stack):
            self.product['productCode']+=s.strip()
def fetch(url):
    if urlparse(url).scheme != 'https' or urlparse(url).netloc != 'webtrack.woodsonlumber.com':
        raise RuntimeError('Catalog crawl must remain on Woodson WebTrack')
    req=urllib.request.Request(url,headers={'User-Agent':'Woodson holiday catalog validation'})
    with urllib.request.urlopen(req,timeout=30) as r: source=r.read().decode('utf-8')
    p=CatalogParser();p.feed(source);return p

p=fetch(ROOT); total=int(re.search(r'Results\s+\d+\s*-\s*\d+\s*\(of\s+(\d+)\)', ' '.join(p.text)).group(1))
products={a['productId']:a for a in p.products}
urls=[ROOT.replace('pageIndex=0','pageIndex='+str(n*48)) for n in range(1,(total+47)//48)]
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    for page in pool.map(fetch,urls):products.update({a['productId']:a for a in page.products})
if any(not re.fullmatch(r'[A-Za-z0-9._/-]+',p['productCode']) for p in products.values()):raise RuntimeError('Missing or malformed product codes')
if len(products)!=total:raise RuntimeError(f'Expected {total} unique products; received {len(products)}')
groups={'4649':{'id':'4649','name':'Christmas Shop','href':ROOT,'parentId':None}}
queue=[dict(g,parentId='4649') for g in p.groups]
while queue:
    batch=[g for g in queue if g['id'] not in groups];queue=[]
    if not batch:break
    if len(groups)+len(batch)>60:raise RuntimeError('Unexpected category expansion')
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        pages=list(pool.map(fetch,[g['href'] for g in batch]))
    for g,page in zip(batch,pages):
        groups[g['id']]=g
        queue.extend(dict(child,parentId=g['id']) for child in page.groups if child['id'] not in groups)
out={'campaign':'christmas-2026','snapshotDate':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).date().isoformat(),'source':ROOT,'productCount':total,'products':sorted(products.values(),key=lambda x:int(x['productId'])),'groups':list(groups.values())}
path=Path(__file__).resolve().parents[1]/'data/christmas-shop-2026.json';path.write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'products':len(products),'groups':len(groups),'missingCodes':sum(not p['productCode'] for p in products.values()),'categories':list(groups.values())},indent=2))
