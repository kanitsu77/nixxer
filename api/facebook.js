const axios = require("axios");
const cheerio = require("cheerio");

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Upgrade-Insecure-Requests": "1",
};

async function scrapeFacebook(url) {
  const res = await axios.get(url, {
    headers,
    maxRedirects: 15,
    timeout: 30000,
    validateStatus: (status) => status >= 200 && status < 400,
  });

  const html = res.data;
  const $ = cheerio.load(html);

  const meta = (name) =>
    $(`meta[property="${name}"]`).attr("content") || $(`meta[name="${name}"]`).attr("content") || "";

  const video = meta("og:video") || meta("og:video:url") || meta("og:video:secure_url");

  if (!video) {
    throw new Error(
      "Gak nemu link video, post mungkin private, butuh login, atau Facebook ganti struktur og:meta-nya."
    );
  }

  return {
    title: meta("og:title") || $("title").text().trim() || null,
    thumbnail: meta("og:image") || null,
    video,
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
    const raw = await scrapeFacebook(url);
    const result = {
      title: raw.title,
      author: null,
      thumbnail: raw.thumbnail,
      stats: null,
      media: [{ type: "video", url: raw.video, label: "Video" }],
    };
    res.status(200).json({ status: "success", result });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};
