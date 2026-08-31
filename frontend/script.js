const PLATFORMS = [
  {
    id: "tiktok",
    name: "TikTok",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l9-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="15" cy="16" r="3"></circle></svg>',
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.3" cy="6.7" r="0.9" fill="currentColor" stroke="none"></circle></svg>',
  },
  {
    id: "youtube",
    name: "YouTube",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="4"></rect><path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none"></path></svg>',
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M13.5 8.2h-1.2c-.9 0-1.3.5-1.3 1.4v1.4H8.7V13h2.3v6h2.4v-6h1.9l.3-2H13.4v-1c0-.5.2-.9.9-.9h1.2V8.2z" fill="currentColor" stroke="none"></path></svg>',
  },
];

let activePlatform = "tiktok";

const tabsEl = document.getElementById("platformTabs");
const urlInput = document.getElementById("urlInput");
const goBtn = document.getElementById("goBtn");
const pasteBtn = document.getElementById("pasteBtn");
const hint = document.getElementById("hint");
const resultWrap = document.getElementById("resultWrap");
const resultCard = document.getElementById("resultCard");

function renderTabs() {
  tabsEl.innerHTML = PLATFORMS.map(
    (p) => `<button data-id="${p.id}" class="${p.id === activePlatform ? "active" : ""}">${p.icon} ${p.name}</button>`
  ).join("");
}

tabsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-id]");
  if (!btn) return;
  activePlatform = btn.dataset.id;
  renderTabs();
  resultWrap.style.display = "none";
  setHint("");
});

renderTabs();

function setHint(msg, type) {
  hint.textContent = msg || "";
  hint.className = "hint" + (type ? " " + type : "");
}

function formatNum(n) {
  if (n === null || n === undefined) return null;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "jt";
  if (n >= 1000) return (n / 1000).toFixed(1) + "rb";
  return String(n);
}

function renderResult(r) {
  const statsParts = [];

  if (r.stats) {
    if (r.stats.like !== undefined) statsParts.push(`♥ ${formatNum(r.stats.like) ?? "-"}`);
    if (r.stats.comment !== undefined) statsParts.push(`💬 ${formatNum(r.stats.comment) ?? "-"}`);
    if (r.stats.views !== undefined && r.stats.views !== null) statsParts.push(`▶ ${formatNum(r.stats.views)}`);
    if (r.stats.save !== undefined) statsParts.push(`⭐ ${formatNum(r.stats.save) ?? "-"}`);
    if (r.stats.share !== undefined) statsParts.push(`↗ ${formatNum(r.stats.share) ?? "-"}`);
  }

  resultCard.innerHTML = `
    <div class="result-top">
      ${r.thumbnail ? `<img class="result-cover" src="${r.thumbnail}" alt="cover">` : ""}
      <div class="result-info">
        <div class="result-title">${r.title || "(tanpa judul)"}</div>
        ${r.author ? `<div class="result-author">${r.author}</div>` : ""}
        ${statsParts.length ? `<div class="result-stats">${statsParts.join(" ")}</div>` : ""}
      </div>
    </div>
    <div class="result-actions">
      ${
        r.media.length
          ? r.media
              .map(
                (m, i) =>
                  `<a class="dl-btn ${i === 0 ? "primary" : ""}" href="${m.url}" target="_blank" rel="noopener" download>${m.label} <span class="arrow">↓</span></a>`
              )
              .join("")
          : `<div class="hint error">Gak ada media yang bisa diunduh.</div>`
      }
    </div>
  `;

  resultWrap.style.display = "block";
}

pasteBtn.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      urlInput.value = text.trim();
      urlInput.focus();
      setHint("");
    }
  } catch {
    setHint("Gak bisa akses clipboard, izinkan aksesnya dulu, atau paste manual.", "error");
  }
});

async function process() {
  const url = urlInput.value.trim();

  if (!url) {
    setHint("Tempel link dulu.", "error");
    return;
  }

  goBtn.disabled = true;
  resultWrap.style.display = "none";
  setHint("Memproses...", "loading");

  try {
    const resp = await fetch(`/scrape/${activePlatform}?url=${encodeURIComponent(url)}`);
    const json = await resp.json();

    if (json.status === "error") {
      setHint(json.message || "Gagal memproses link.", "error");
      return;
    }

    setHint("");
    renderResult(json.result);
  } catch {
    setHint("Gagal konek ke server. Coba lagi.", "error");
  } finally {
    goBtn.disabled = false;
  }
}

goBtn.addEventListener("click", process);
urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") process();
});
