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

/** A picture frame. The button beside it says what it does. */
const COVER_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="10" r="1.5" fill="currentColor"/><path d="M5 17l4.5-4.5 3 3L16 12l3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

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
.edit-cover{display:inline-flex;align-items:center;justify-content:center;width:2rem;height:2rem;
padding:0;color:var(--link-color);background:none;border:1px solid var(--border-color);
border-radius:var(--border-radius);cursor:pointer}
.edit-cover svg{width:1.1rem;height:1.1rem}
.edit-cover:hover,.edit-cover:focus-visible{color:var(--link-hover-color);background:var(--bg-subtle)}
.edit-cover[data-on]{background:var(--text-strong);color:var(--bg);border-color:var(--text-strong)}
.edit-hint{margin:var(--space-small) 0 0;font-size:.8rem;color:var(--text-muted)}
.edit-hint[hidden]{display:none}
.edit-picking .grid .tile{cursor:copy}
.edit-picking .grid .tile:hover,.edit-picking .grid .tile:focus-visible{outline:3px solid var(--text-strong);
outline-offset:2px}
.edit-is-cover .tile::after{content:"Cover";position:absolute;inset-block-start:.4rem;
inset-inline-end:.4rem;padding:.1rem .4rem;border-radius:var(--border-radius);
background:oklch(17% 0 0 / .72);color:oklch(100% 0 0);font-size:.7rem;letter-spacing:.06em;
text-transform:uppercase}
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
d.textContent="Delete";d.title="Delete (D)";bar.appendChild(d);
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
// Choosing a cover is a comparative act — you pick it by looking at the wall,
// not by remembering a filename — so the control lives on the album page and the
// thumbnails themselves become the input. data-items is the only thing that has
// to travel: a tile's href carries an id, and album.md wants a file name.
var raw=p.getAttribute("data-items");
if(raw){
var byId=JSON.parse(raw),grid=document.querySelector(".grid"),
head=document.querySelector(".album-head"),tools=document.querySelector(".album-tools"),
cover=f.querySelector("[name=cover]");
if(head&&!tools){tools=document.createElement("div");tools.className="album-tools";head.appendChild(tools);}
if(grid&&tools){
var cb=document.createElement("button");cb.type="button";cb.className="edit-cover";
cb.innerHTML=${JSON.stringify(COVER_ICON)};
tools.appendChild(cb);
var hint=document.createElement("p");hint.className="edit-hint";hint.hidden=true;
head.insertAdjacentElement("afterend",hint);
function idOf(a){return a.getAttribute("href").split("/")[2]||"";}
function mark(){
var want=cover?cover.value:"";
[].forEach.call(grid.children,function(li){
var a=li.querySelector("a[href^='/media/']");
li.classList.toggle("edit-is-cover",!!a&&byId[idOf(a)]===want);});}
mark();
var picking=false;
function pick(v){
picking=v;
document.body.classList.toggle("edit-picking",v);
if(v){cb.setAttribute("data-on","")}else{cb.removeAttribute("data-on")}
cb.title=v?"Choosing a cover \u2014 Esc to cancel":"Set the cover picture";
cb.setAttribute("aria-label",cb.title);
hint.hidden=!v;
hint.textContent="Click a picture to make it this album's cover. Esc to cancel.";}
pick(false);
cb.addEventListener("click",function(){pick(!picking)});
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&picking)pick(false)});
grid.addEventListener("click",function(e){
if(!picking)return;
var a=e.target&&e.target.closest?e.target.closest("a[href^='/media/']"):null;
if(!a)return;
e.preventDefault();
var file=byId[idOf(a)];if(!file)return;
if(cover)cover.value=file;
pick(false);
hint.hidden=false;hint.textContent="Setting cover to "+file+"\u2026";
mark();
f.requestSubmit();},true);
}
}
function show(v){p.hidden=!v;try{localStorage.setItem("edit-open",v?"1":"0")}catch(e){}}
try{if(localStorage.getItem("edit-open")==="1")show(true)}catch(e){}
b.addEventListener("click",function(){show(p.hidden)});
var x=p.querySelector(".edit-close");if(x)x.addEventListener("click",function(){show(false)});
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!p.hidden)show(false)});
/*
 * E opens the panel, D deletes. Both are the buttons' own behaviour rather than a
 * second path to it — D calls click(), so it arms the button and waits for a
 * second press exactly as the mouse does. A key that deleted on the first press
 * would be a key that deletes something you were not looking at.
 *
 * The guards matter more here than on the public shortcuts. Typing "d" into the
 * description field must not delete the item, and neither must a keystroke aimed
 * at an open dialog.
 */
document.addEventListener("keydown",function(e){
if(e.metaKey||e.ctrlKey||e.altKey||e.shiftKey)return;
var t=e.target;
if(t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))return;
if(document.querySelector("dialog[open]"))return;
if(e.key==="e"||e.key==="E"){e.preventDefault();show(p.hidden);return;}
if((e.key==="d"||e.key==="D")&&d){e.preventDefault();d.click();}});
// The panel that lists the public keys gains these two while the editor is on.
var keys=document.querySelector(".help-keys");
if(keys){
var rows="<dt><kbd>E</kbd></dt><dd>Edit this "+(del?"item":"album")+"</dd>";
if(del)rows+="<dt><kbd>D</kbd></dt><dd>Delete it \u2014 twice, to be sure</dd>";
keys.insertAdjacentHTML("beforeend",rows);}
f.addEventListener("submit",function(e){
e.preventDefault();s.textContent="Saving\\u2026";
var body={};
new FormData(f).forEach(function(v,k){body[k]=v});
fetch("/_edit",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)})
.then(function(r){return r.ok?(s.textContent="Saved",location.reload()):r.text().then(function(t){s.textContent=t||("Failed ("+r.status+")")})})
.catch(function(err){s.textContent="Failed: "+err});
});
})()`;

/** `heading` is HTML — callers escape whatever they interpolate into it. */
function panel(heading: string, hidden: string, fields: string, data = ""): string {
  return `<button type="button" class="edit-open" title="Edit (E)">Edit</button>
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
${field("alt", "Alt text", item.alt)}`,
    ` data-slug="${esc(album.slug)}" data-delete="${esc(item.id)}"`,
  );
}

export function albumEditor(album: Album): string {
  const byId = Object.fromEntries(album.items.map((item) => [item.id, item.file]));
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
    ` data-items="${esc(JSON.stringify(byId))}"`,
  );
}
