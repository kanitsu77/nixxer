const vm = require("vm");

async function scrapeSnackvideo(url) {
  if (!url || typeof url !== "string") {
    throw new Error("URL SnackVideo diperlukan");
  }

  const cleanUrl = url.trim();

  if (!cleanUrl.includes("snackvideo.com") && !cleanUrl.includes("s.snackvideo.com")) {
    throw new Error("Bukan URL SnackVideo yang valid");
  }

  const res = await fetch(cleanUrl, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });

  if (!res.ok) {
    throw new Error("Gagal menghubungkan ke SnackVideo");
  }

  const html = await res.text();
  const idx = html.indexOf("window.__NUXT__=");
  let photoData = null;

  if (idx !== -1) {
    const endIdx = html.indexOf("</script>", idx);
    const scriptContent = html.substring(idx, endIdx);
    const sandbox = { window: {} };
    vm.createContext(sandbox);

    try {
      vm.runInContext(scriptContent, sandbox);
      const nuxt = sandbox.window.__NUXT__;
      const videoList = nuxt?.state?.videoList || nuxt?.videoList || [];
      photoData = videoList[0] || null;
    } catch {
      photoData = null;
    }
  }

  if (!photoData) {
    const mp4Match = html.match(/https?:\/\/[^\s"'\\]+\.mp4[^\s"'\\]*/i);

    if (mp4Match) {
      return {
        title: null,
        author: null,
        thumbnail: null,
        stats: null,
        media: [{ type: "video", url: mp4Match[0], label: "Video" }],
      };
    }

    throw new Error("Video SnackVideo tidak ditemukan atau telah dihapus");
  }

  const videoUrl = photoData.main_mv_urls?.[0]?.url || photoData.main_mv_url || null;
  const thumbnailUrl =
    photoData.cover_thumbnail_urls?.[0]?.url || photoData.cover_first_frame_urls?.[0]?.url || null;

  return {
    title: photoData.caption || null,
    author: photoData.user_name || photoData.kwai_id || null,
    thumbnail: thumbnailUrl,
    stats: {
      like: photoData.like_count ?? null,
      comment: photoData.comment_count ?? null,
      views: photoData.view_count ?? null,
      share: photoData.forward_count ?? null,
    },
    media: videoUrl ? [{ type: "video", url: videoUrl, label: "Video" }] : [],
  };
}

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ status: "error", message: "Method not allowed" });
    return;
  }

  const { url } = req.query;

  if (!url) {
    res.status(400).json({ status: "error", message: "Parameter ?url= wajib diisi" });
    return;
  }

  try {
    const result = await scrapeSnackvideo(url);
    res.status(200).json({ status: "success", result });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};
