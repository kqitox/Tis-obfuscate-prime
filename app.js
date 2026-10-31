const $ = (id) => document.getElementById(id);
const source = $("source"), output = $("output");
let currentName = "script.lua";
let mode = "light";
let toastTimer;

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2300);
}
function bytes(text) { return new TextEncoder().encode(text).length; }
function stats(text) {
  const lines = text ? text.split(/\r\n|\r|\n/).length : 0;
  return `${lines} lines · ${bytes(text)} bytes`;
}
function updateEditor() {
  const count = Math.max(1, source.value.split(/\r\n|\r|\n/).length);
  $("lineNumbers").textContent = Array.from({length:count},(_,i)=>i+1).join("\n");
  $("sourceStats").textContent = stats(source.value);
  $("fileLabel").textContent = currentName;
}
function updateOutput() {
  $("outputStats").textContent = stats(output.value);
  $("outputLabel").textContent = output.value ? "Encoded Lua ready" : "Output will appear here";
  $("outputBadge").textContent = output.value ? "DONE" : "READY";
}
function copyText(value, success = "Copied!") {
  if (!value) return toast("Không có nội dung để sao chép.");
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(value).then(() => toast(success)).catch(() => fallbackCopy(value, success));
  } else fallbackCopy(value, success);
}
function fallbackCopy(value, success) {
  const box = document.createElement("textarea");
  box.value = value; box.style.position = "fixed"; box.style.opacity = "0";
  document.body.appendChild(box); box.select();
  try { document.execCommand("copy"); toast(success); } catch { toast("Không thể sao chép tự động."); }
  box.remove();
}
function base64(bytesArray) {
  let binary = "";
  for (const byte of bytesArray) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function encodeLua(text, selectedMode) {
  const data = new TextEncoder().encode(text);
  const key = new TextEncoder().encode(selectedMode === "standard" ? "LuaEncoderVIP-2026" : "LuaVIP");
  const encoded = data.map((byte, i) => byte ^ key[i % key.length]);
  const payload = base64(encoded);
  const keyValues = [...key].join(",");
  // Decoder uses standard Lua 5.1+ bitwise-free arithmetic XOR.
  return `-- Lua Encoder VIP | XOR + Base64
-- Note: basic obfuscation, not cryptographic protection.
local data = "${payload}"
local key = {${keyValues}}
local b='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
local decoded = data:gsub('.', function(x)
  if x == '=' then return '' end
  local r,f='',(b:find(x,1,true)-1)
  for i=6,1,-1 do r=r..(f%2^i-f%2^(i-1)>0 and '1' or '0') end
  return r
end):gsub('%d%d%d?%d?%d?%d?%d?%d?', function(x)
  if #x ~= 8 then return '' end
  local c=0
  for i=1,8 do c=c*2+(x:sub(i,i)=='1' and 1 or 0) end
  return string.char(c)
end)
local out={}
for i=1,#decoded do
  local a,bv=decoded:byte(i),key[((i-1)%#key)+1]
  local res,p=0,1
  while a>0 or bv>0 do
    local aa,bb=a%2,bv%2
    if aa~=bb then res=res+p end
    a,bv=math.floor(a/2),math.floor(bv/2)
    p=p*2
  end
  out[i]=string.char(res)
end
local source=table.concat(out)
local fn,err=loadstring(source)
if not fn then error(err) end
return fn()
`;
}
source.addEventListener("input", updateEditor);
source.addEventListener("scroll", () => { $("lineNumbers").scrollTop = source.scrollTop; });
$("uploadBtn").addEventListener("click", () => $("fileInput").click());
$("fileInput").addEventListener("change", async e => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (file.size > 1_500_000) { toast("File vượt giới hạn 1.5 MB."); e.target.value=""; return; }
  source.value = await file.text();
  currentName = file.name;
  updateEditor(); toast("Đã tải file lên editor.");
  e.target.value = "";
});
$("clearBtn").addEventListener("click", () => {
  source.value = ""; output.value = ""; currentName = "script.lua";
  updateEditor(); updateOutput(); $("resultBox").classList.add("hidden");
});
$("copySource").addEventListener("click", () => copyText(source.value, "Đã copy source."));
document.querySelectorAll(".mode").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".mode").forEach(b => b.classList.remove("active"));
  btn.classList.add("active"); mode = btn.dataset.mode;
}));
$("encodeBtn").addEventListener("click", () => {
  if (!source.value.trim()) return toast("Hãy nhập hoặc tải code Lua trước.");
  output.value = encodeLua(source.value, mode);
  updateOutput(); toast("Đã mã hóa code Lua.");
});
$("copyOutput").addEventListener("click", () => copyText(output.value, "Đã copy output."));
$("downloadBtn").addEventListener("click", () => {
  if (!output.value) return toast("Chưa có output để tải.");
  const blob = new Blob([output.value], {type:"text/plain;charset=utf-8"});
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href=url; a.download=currentName.replace(/\.(lua|luau|txt)$/i,"")+"_encoded.lua";
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  toast("Đang tải output.");
});
$("hostBtn").addEventListener("click", async () => {
  if (!source.value.trim()) return toast("Hãy nhập hoặc tải code Lua trước.");
  const btn = $("hostBtn"); btn.disabled = true; btn.textContent = "Creating...";
  try {
    const response = await fetch("/api/scripts", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({name:currentName,code:source.value})
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Không thể tạo Raw Link.");
    $("rawUrl").value=result.rawUrl; $("loadstring").value=result.loadstring;
    $("resultBox").classList.remove("hidden");
    toast("Đã tạo Raw Link và Loadstring.");
    await loadLibrary();
  } catch (err) { toast(err.message || "Lỗi kết nối server."); }
  finally { btn.disabled=false; btn.innerHTML="<span>↗</span> Create Raw Link"; }
});
document.querySelectorAll("[data-copy]").forEach(btn => btn.addEventListener("click", () => {
  copyText($(btn.dataset.copy).value, "Đã sao chép.");
}));
$("refreshLibrary").addEventListener("click", loadLibrary);

async function loadLibrary() {
  const list = $("libraryList");
  try {
    const response = await fetch("/api/scripts");
    const scripts = await response.json();
    if (!scripts.length) { list.innerHTML='<div class="empty">Chưa có script nào được lưu.</div>'; return; }
    list.innerHTML = scripts.map(item => `
      <div class="library-item">
        <div><div class="lib-name">${escapeHtml(item.name)}</div>
        <div class="lib-meta">${formatBytes(item.bytes)} · ${new Date(item.createdAt).toLocaleString()}</div></div>
        <div class="lib-actions"><button class="mini-link" data-open="${item.id}">Raw</button><button class="mini-link" data-del="${item.id}">Delete</button></div>
      </div>`).join("");
    list.querySelectorAll("[data-open]").forEach(btn => btn.addEventListener("click", () => {
      const url = `${location.origin}/raw/${btn.dataset.open}`;
      copyText(url, "Đã copy Raw URL.");
    }));
    list.querySelectorAll("[data-del]").forEach(btn => btn.addEventListener("click", async () => {
      if (!confirm("Xóa script này khỏi database?")) return;
      const res = await fetch(`/api/scripts/${btn.dataset.del}`, {method:"DELETE"});
      if (res.ok) { toast("Đã xóa script."); loadLibrary(); }
      else toast("Không thể xóa script.");
    }));
  } catch { list.innerHTML='<div class="empty">Không tải được danh sách. Kiểm tra server.</div>'; }
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function formatBytes(n) { return n < 1024 ? `${n} B` : `${(n/1024).toFixed(1)} KB`; }
updateEditor(); updateOutput(); loadLibrary();
