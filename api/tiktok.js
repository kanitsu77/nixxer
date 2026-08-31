async function scrapeTiktok(url) {
  const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
  const resp = await fetch(apiUrl);

  if (!resp.ok) {
    throw new Error(`Gagal konek ke tikwm: HTTP ${resp.status}`);
  }

  const json = await resp.json();

  if (json.code !== 0 || !json.data) {
    throw new Error(json.msg || "Link invalid, private, atau kena rate limit");
  }

  const d = json.data;
  const isPhoto = Array.isArray(d.images) && d.images.length > 0;

  const media = [];

  if (isPhoto) {
    d.images.forEach((img, i) => {
      media.push({ type: "photo", url: img, label: `Gambar ${i + 1}` });
    });
    if (d.music) {
      media.push({ type: "audio", url: d.music, label: "Audio (MP3)" });
    }
  } else {
    if (d.play) media.push({ type: "video", url: d.play, label: "Video — Tanpa Watermark" });
    if (d.hdplay) media.push({ type: "video", url: d.hdplay, label: "Video — HD" });
    if (d.wmplay) media.push({ type: "video", url: d.wmplay, label: "Video — Dengan Watermark" });
    if (d.music) media.push({ type: "audio", url: d.music, label: "Audio (MP3)" });
  }

  return {
    title: d.title || null,
    author: d.author?.nickname || d.author?.unique_id || null,
    thumbnail: d.cover || d.origin_cover || (isPhoto ? d.images?.[0] : null) || null,
    stats: {
      like: d.digg_count ?? 0,
      comment: d.comment_count ?? 0,
      save: d.collect_count ?? 0,
      share: d.share_count ?? 0,
    },
    media,
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
    const result = await scrapeTiktok(url);
    res.status(200).json({ status: "success", result });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};
