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
  {
    id: "snackvideo",
    name: "SnackVideo",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="4"></rect><path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none"></path></svg>',
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

function extFor(type) {
  if (type === "video") return "mp4";
  if (type === "audio") return "mp3";
  return "jpg";
}

function dlHref(item, index) {
  const unique = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const filename = `${activePlatform}-${item.type}-${index + 1}-${unique}.${extFor(item.type)}`;
  return `/scrape/download?url=${encodeURIComponent(item.url)}&filename=${encodeURIComponent(filename)}`;
}

function statsHtml(stats) {
  const parts = [];
  if (stats) {
    if (stats.like !== undefined) parts.push(`♥ ${formatNum(stats.like) ?? "-"}`);
    if (stats.comment !== undefined) parts.push(`💬 ${formatNum(stats.comment) ?? "-"}`);
    if (stats.views !== undefined && stats.views !== null) parts.push(`▶ ${formatNum(stats.views)}`);
    if (stats.save !== undefined) parts.push(`⭐ ${formatNum(stats.save) ?? "-"}`);
    if (stats.share !== undefined) parts.push(`↗ ${formatNum(stats.share) ?? "-"}`);
  }
  return parts.length ? `<div class="result-stats">${parts.join(" ")}</div>` : "";
}

function infoBlockHtml(r, coverUrl) {
  return `
    <div class="result-top">
      ${coverUrl ? `<img class="result-cover" src="${coverUrl}" alt="cover">` : ""}
      <div class="result-info">
        <div class="result-title">${r.title || "(tanpa judul)"}</div>
        ${r.author ? `<div class="result-author">${r.author}</div>` : ""}
        ${statsHtml(r.stats)}
      </div>
    </div>
  `;
}

function renderResult(r) {
  const media = r.media || [];
  const photos = media.filter((m) => m.type === "photo");
  const others = media.filter((m) => m.type !== "photo");

  if (photos.length > 0) {
    const firstIndex = media.indexOf(photos[0]);
    let html = `
      ${infoBlockHtml(r, r.thumbnail || photos[0].url)}
      <div class="result-actions">
        <a class="dl-btn primary" href="${dlHref(photos[0], firstIndex)}">Unduh Gambar${photos.length > 1 ? " 1" : ""} <span class="arrow">↓</span></a>
        ${others.map((m) => {
          const idx = media.indexOf(m);
          return `<a class="dl-btn" href="${dlHref(m, idx)}">${m.label} <span class="arrow">↓</span></a>`;
        }).join("")}
      </div>
    `;

    if (photos.length > 1) {
      html += `<div class="section-label">Foto lainnya (${photos.length - 1})</div>`;
      photos.slice(1).forEach((photo) => {
        const idx = media.indexOf(photo);
        html += `
          <div class="photo-item">
            <img src="${photo.url}" alt="${photo.label}">
            <a class="dl-btn" href="${dlHref(photo, idx)}">Unduh ${photo.label} <span class="arrow">↓</span></a>
          </div>
        `;
      });
    }

    resultCard.innerHTML = html;
  } else {
    resultCard.innerHTML = `
      ${infoBlockHtml(r, r.thumbnail)}
      <div class="result-actions">
        ${media.length
          ? media.map((m, i) => `<a class="dl-btn ${i === 0 ? "primary" : ""}" href="${dlHref(m, i)}">${m.label} <span class="arrow">↓</span></a>`).join("")
          : `<div class="hint error">Gak ada media yang bisa diunduh.</div>`
        }
      </div>
    `;
  }

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
