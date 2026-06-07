import re

with open('public/seo-dashboard.html', 'r') as f:
    content = f.read()

# Replace the renderCrawlList function with a paginated version
# Find the function by regex
old_pattern = r'function renderCrawlList\(\)\{[^}]+\{[^}]+\{[^}]+\}[^}]+\}[^}]+\}[^}]+\}'

new_render = """let crawlPage = 0;
const CRAWL_PER_PAGE = 50;
let crawlFilterMode = 'all';
function renderCrawlList(){
  const el = document.getElementById('crawl-url-list');
  if(!el) return;
  const total = ALL_URLS.length;
  const successCount = ALL_URLS.filter(u=>crawlState[u]==='success').length;
  const failCount = ALL_URLS.filter(u=>crawlState[u]==='failed').length;
  const pendingCount = total - successCount - failCount;
  const pct = Math.round((successCount/total)*100);
  let filteredUrls = crawlFilterMode==='failed' ? ALL_URLS.filter(u=>crawlState[u]==='failed') : ALL_URLS;
  const totalPages = Math.ceil(filteredUrls.length / CRAWL_PER_PAGE);
  if(crawlPage >= totalPages) crawlPage = Math.max(0, totalPages-1);
  const start = crawlPage * CRAWL_PER_PAGE;
  const end = Math.min(start + CRAWL_PER_PAGE, filteredUrls.length);
  let html = '<div style="margin-bottom:16px">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-size:.85rem;font-weight:600">Progress: '+successCount+'/'+total+' submitted ('+pct+'%)</span><span style="font-size:.78rem;color:var(--muted)">Showing '+(start+1)+'-'+end+' of '+filteredUrls.length+'</span></div>';
  html += '<div style="height:8px;background:var(--surface2);border-radius:4px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:var(--green);border-radius:4px;transition:width .3s"></div></div>';
  html += '</div>';
  html += '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">';
  html += '<button class="btn btn-outline" onclick="crawlPage=Math.max(0,crawlPage-1);renderCrawlList()" '+(crawlPage===0?'disabled':'')+' style="font-size:.75rem;padding:4px 10px">\\u2190 Prev</button>';
  html += '<button class="btn btn-outline" onclick="crawlPage=Math.min('+(totalPages-1)+',crawlPage+1);renderCrawlList()" '+(crawlPage>=totalPages-1?'disabled':'')+' style="font-size:.75rem;padding:4px 10px">Next \\u2192</button>';
  html += '<select onchange="crawlPage=parseInt(this.value);renderCrawlList()" style="font-size:.75rem;padding:4px 8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text)">';
  for(let i=0;i<totalPages;i++) html += '<option value="'+i+'"'+(i===crawlPage?' selected':'')+'>Page '+(i+1)+'</option>';
  html += '</select>';
  html += '<button class="btn btn-outline" onclick="crawlFilterMode=crawlFilterMode===\\'failed\\'?\\'all\\':\\'failed\\';crawlPage=0;renderCrawlList()" style="font-size:.75rem;padding:4px 10px">'+(crawlFilterMode==='failed'?'Show All':'Show Failed Only')+'</button>';
  html += '</div>';
  const pageUrls = filteredUrls.slice(start, end);
  pageUrls.forEach(function(url){
    const id = url.replace(/\\//g,'_').replace(/[^a-z0-9_]/gi,'_');
    const state = crawlState[url] || 'pending';
    let statusHtml;
    if(state === 'success') statusHtml = '<span class="dot dot-green"></span><span style="color:var(--green)">Submitted \\u2713</span>';
    else if(state === 'failed') statusHtml = '<span class="dot" style="background:var(--red)"></span><span style="color:var(--red)">Failed</span>';
    else statusHtml = '<span class="dot dot-yellow"></span><span style="color:var(--yellow)">Pending</span>';
    html += '<div class="crawl-url-item" id="crawl-item-'+id+'"><div style="font-size:.78rem;font-family:monospace;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%">'+SITE+url+'</div><div class="crawl-status" id="crawl-status-'+id+'">'+statusHtml+'</div></div>';
  });
  el.innerHTML = html;
}"""

# Simple string replacement approach - find the exact function
search_str = "function renderCrawlList(){\n  const el = document.getElementById('crawl-url-list');"
if search_str in content:
    # Find the end of the function
    start_idx = content.index(search_str)
    # Count braces to find end
    brace_count = 0
    i = start_idx
    found_first = False
    while i < len(content):
        if content[i] == '{':
            brace_count += 1
            found_first = True
        elif content[i] == '}':
            brace_count -= 1
            if found_first and brace_count == 0:
                end_idx = i + 1
                break
        i += 1
    
    old_func = content[start_idx:end_idx]
    content = content[:start_idx] + new_render + content[end_idx:]
    print(f"Replaced renderCrawlList function ({len(old_func)} chars -> {len(new_render)} chars)")
else:
    print("Could not find renderCrawlList function")

# Also update the pushAllCrawl to add a progress bar update
old_push = "for(const url of ALL_URLS){\n    await pushSingleUrl(url);\n    await sleep(300);\n  }"
new_push = "for(let i=0;i<ALL_URLS.length;i++){\n    await pushSingleUrl(ALL_URLS[i]);\n    if(i%10===0) renderCrawlList();\n    await sleep(200);\n  }\n  renderCrawlList();"
if old_push in content:
    content = content.replace(old_push, new_push)
    print("Updated pushAllCrawl with progress updates")
else:
    print("Could not find pushAllCrawl loop (may already be updated)")

with open('public/seo-dashboard.html', 'w') as f:
    f.write(content)

print(f"Dashboard updated. File size: {len(content)} bytes")
