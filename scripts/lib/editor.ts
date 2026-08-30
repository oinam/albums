import type { Album, Item } from "./albums.ts";

/**
 * The local metadata editor.
 *
 * It exists so the title, date and description of a picture can be written while
 * looking at the picture, rather than by counting braces in `photos.json`. It is
 * a development tool and nothing else: the panel is rendered only when the build
 * is in local mode, so a production build emits none of it — no markup, no style,
 * no script, no `/_edit` reference anywhere in `dist/`.
 *
 * Everything it needs travels with it. The markup is plain, the style is inline
 * and prefixed `edit-`, and none of it touches `site.css` — the page being edited
 * has to look exactly like the page that ships.
 */

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function field(
  name: string,
  label: string,
  value: string | undefined,
  hint = "",
): string {
  return `<label class="edit-field"><span>${esc(label)}</span>
<input type="text" name="${esc(name)}" value="${esc(value ?? "")}"${hint ? ` placeholder="${esc(hint)}"` : ""}></label>`;
}

function area(name: string, label: string, value: string | undefined): string {
  return `<label class="edit-field"><span>${esc(label)}</span>
<textarea name="${esc(name)}" rows="4">${esc(value ?? "")}</textarea></label>`;
}

const STYLE = `
.edit-bar{display:flex;justify-content:center;gap:.5rem;margin:var(--space-small) 0}
.edit-bar button{font:inherit;font-size:.95rem;padding:.5rem 1.4rem;border-radius:8px;
cursor:pointer;line-height:1.2;border:1px solid var(--border-color);
background:var(--bg-subtle);color:var(--text-strong);transition:all .15s ease}
.edit-bar button:hover,.edit-bar button:focus-visible{border-color:var(--text-muted)}
.edit-delete[data-armed]{background:oklch(52% .19 27);border-color:oklch(52% .19 27);
color:oklch(100% 0 0)}
.edit-open{position:fixed;right:16px;bottom:16px;z-index:9998;font:inherit;font-size:.95rem;
padding:.5rem 1.4rem;border-radius:8px;cursor:pointer;line-height:1.2;
border:1px solid var(--border-color);background:var(--bg-subtle);color:var(--text-strong)}
.edit-panel[hidden]{display:none}
.edit-panel{position:fixed;right:12px;bottom:72px;z-index:9999;width:min(360px,calc(100vw - 24px));
max-height:min(70vh,640px);overflow:auto;padding:1rem;border-radius:6px;
border:1px solid var(--border-color);background:var(--bg);
box-shadow:0 8px 32px oklch(0% 0 0 / .25);font-size:.85rem}
.edit-panel h2{position:sticky;top:-1rem;z-index:1;display:flex;align-items:center;
justify-content:space-between;gap:1rem;background:var(--bg);
margin:-1rem -1rem .75rem;padding:1rem 1rem .6rem;
font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;
color:var(--text-muted);border:0}
.edit-close{flex:none;font:inherit;font-size:1.1rem;line-height:1;padding:.1rem .5rem .2rem;
border-radius:6px;border:1px solid var(--border-color);background:var(--bg-subtle);
color:var(--text-strong);cursor:pointer}
.edit-close:hover,.edit-close:focus-visible{border-color:var(--text-muted)}
.edit-field{display:block;margin-bottom:.6rem}
.edit-field span{display:block;font-size:.7rem;letter-spacing:.06em;text-transform:uppercase;
color:var(--text-muted);margin-bottom:.2rem}
.edit-panel input[type=text],.edit-panel textarea{width:100%;font:inherit;font-size:.85rem;
padding:.35rem .45rem;border-radius:4px;border:1px solid var(--border-color);
background:var(--bg);color:var(--text-strong)}
.edit-panel textarea{resize:vertical}
.edit-check{display:flex;align-items:center;gap:.4rem;margin-bottom:.75rem}
.edit-actions{display:flex;align-items:center;gap:.6rem}
.edit-actions button{font:inherit;font-size:.8rem;padding:.35rem .8rem;border-radius:4px;
border:1px solid var(--border-color);background:var(--bg-subtle);
color:var(--text-strong);cursor:pointer}
.edit-status{color:var(--text-muted);font-size:.75rem}
`.replace(/\n/g, "");

const SCRIPT = `(function(){
var b=document.querySelector(".edit-open"),p=document.querySelector(".edit-panel"),
f=p&&p.querySelector("form"),s=p&&p.querySelector(".edit-status");
if(!b||!p||!f||!s)return;
// The controls belong where the title goes. itemMeta() renders nothing at all
// when an item has no title, date or description, which is exactly the item you
// want to edit — so the bar goes straight after the picture either way, and is
// the only thing in that space when the item is still blank.
var stage=document.querySelector(".stage");
var del=p.getAttribute("data-delete");
if(stage){
var bar=document.createElement("div");bar.className="edit-bar";
stage.insertAdjacentElement("afterend",bar);
b.classList.remove("edit-open");bar.appendChild(b);
if(del){
var d=document.createElement("button");d.type="button";d.className="edit-delete";
d.textContent="Delete";bar.appendChild(d);
var timer;
d.addEventListener("click",function(){
if(!d.hasAttribute("data-armed")){
d.setAttribute("data-armed","");d.textContent="Delete for good?";
timer=setTimeout(function(){d.removeAttribute("data-armed");d.textContent="Delete"},4000);
return;}
clearTimeout(timer);d.textContent="Deleting\u2026";d.disabled=true;
fetch("/_edit",{method:"POST",headers:{"content-type":"application/json"},
body:JSON.stringify({kind:"delete",slug:p.getAttribute("data-slug"),id:del})})
.then(function(r){return r.text().then(function(t){
if(!r.ok){d.disabled=false;d.textContent="Delete";d.removeAttribute("data-armed");s.textContent=t;return;}
location.href=t;});})
.catch(function(err){d.disabled=false;d.textContent="Delete";s.textContent=String(err)});
});
}
}
function show(v){p.hidden=!v;try{localStorage.setItem("edit-open",v?"1":"0")}catch(e){}}
try{if(localStorage.getItem("edit-open")==="1")show(true)}catch(e){}
b.addEventListener("click",function(){show(p.hidden)});
var x=p.querySelector(".edit-close");if(x)x.addEventListener("click",function(){show(false)});
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!p.hidden)show(false)});
f.addEventListener("submit",function(e){
e.preventDefault();s.textContent="Saving\\u2026";
var body={};
new FormData(f).forEach(function(v,k){body[k]=v});
var h=f.elements.highlight;if(h)body.highlight=h.checked;
fetch("/_edit",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)})
.then(function(r){return r.ok?(s.textContent="Saved",location.reload()):r.text().then(function(t){s.textContent=t||("Failed ("+r.status+")")})})
.catch(function(err){s.textContent="Failed: "+err});
});
})()`;

/** `heading` is HTML — callers escape whatever they interpolate into it. */
function panel(heading: string, hidden: string, fields: string, data = ""): string {
  return `<button type="button" class="edit-open">Edit</button>
<aside class="edit-panel"${data} hidden>
<h2>${heading}<button type="button" class="edit-close" aria-label="Close the editor" title="Close (Esc)">&times;</button></h2>
<form>
${hidden}
${fields}
<div class="edit-actions"><button type="submit">Save</button><span class="edit-status"></span></div>
</form>
</aside>
<style>${STYLE}</style>
<script>${SCRIPT}</script>`;
}

export function itemEditor(album: Album, item: Item): string {
  return panel(
    `Item &middot; ${esc(item.file)}`,
    `<input type="hidden" name="kind" value="item">
<input type="hidden" name="slug" value="${esc(album.slug)}">
<input type="hidden" name="id" value="${esc(item.id)}">`,
    `${field("title", "Title", item.title)}
${field("date", "Date", item.date, "2005-06-14, 2005-06, 2005")}
${area("description", "Description", item.description)}
${field("alt", "Alt text", item.alt)}
<label class="edit-check"><input type="checkbox" name="highlight"${item.highlight === true ? " checked" : ""}> Highlight on the home page</label>`,
    ` data-slug="${esc(album.slug)}" data-delete="${esc(item.id)}"`,
  );
}

export function albumEditor(album: Album): string {
  return panel(
    `Album &middot; ${esc(album.slug)}`,
    `<input type="hidden" name="kind" value="album">
<input type="hidden" name="slug" value="${esc(album.slug)}">`,
    `${field("title", "Title", album.meta.title)}
${field("date", "Date", album.meta.date, "1945-46, 2005-06, 2005")}
${field("date_end", "Date end", album.meta.date_end)}
${field("location", "Location", album.meta.location)}
${field("cover", "Cover file", album.meta.cover)}
${area("description", "Description", album.description)}`,
  );
}
