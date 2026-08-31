function extractVideoId(url) {
  if (!url) return null;

  let match = null;
  if (url.includes("youtube.com/shorts/") || url.includes("youtu.be/")) {
    match = /\/([a-zA-Z0-9\-_]{11})/.exec(url);
  } else if (url.includes("youtube.com")) {
    match = /v=([a-zA-Z0-9\-_]{11})/.exec(url);
  } else {
    match = /[a-zA-Z0-9\-_]{11}/.exec(url);
  }

  return match ? match[1] : null;
}

async function scrapeYtmp3(youtubeUrl, format = "mp4") {
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) {
    throw new Error("Link YouTube invalid: gak nemu video ID.");
  }

  const lowerFormat = format.toLowerCase();
  if (lowerFormat !== "mp3" && lowerFormat !== "mp4") {
    throw new Error('Format harus "mp3" atau "mp4".');
  }

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    Origin: "https://id.ytmp3.mobi",
    Referer: "https://id.ytmp3.mobi/",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "cross-site",
  };

  const initUrl = `https://a.ymcdn.org/api/v1/init?p=y&23=1llum1n471&_=${Math.random()}`;
  const initRes = await fetch(initUrl, { headers });
  if (!initRes.ok) throw new Error(`Init gagal: HTTP ${initRes.status}`);
  const initJson = await initRes.json();
  if (initJson.error > 0) throw new Error(`Init API error: ${initJson.error}`);

  let convertRequestUrl = `${initJson.convertURL}&v=${videoId}&f=${lowerFormat}&_=${Math.random()}`;
  let convertJson;

  while (true) {
    const convertRes = await fetch(convertRequestUrl, { headers });
    if (!convertRes.ok) throw new Error(`Convert gagal: HTTP ${convertRes.status}`);
    convertJson = await convertRes.json();
    if (convertJson.error > 0) throw new Error(`Convert API error: ${convertJson.error}`);

    if (convertJson.redirect > 0 && convertJson.redirectURL) {
      convertRequestUrl = `${convertJson.redirectURL}&v=${videoId}&f=${lowerFormat}&_=${Math.random()}`;
      continue;
    }
    break;
  }

  const progressUrl = convertJson.progressURL;
  const downloadUrl = convertJson.downloadURL;
  let title = convertJson.title || "";

  if (!progressUrl) throw new Error("Respons convert gak ada progress URL.");

  let progress = 0;
  let pollCount = 0;
  const maxPolls = 60;

  while (progress < 3 && pollCount < maxPolls) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    pollCount++;

    const progressRes = await fetch(progressUrl, { headers });
    if (!progressRes.ok) throw new Error(`Progress gagal: HTTP ${progressRes.status}`);
    const progressJson = await progressRes.json();
    if (progressJson.error > 0) throw new Error(`Progress API error: ${progressJson.error}`);

    progress = progressJson.progress;
    if (progressJson.title) title = progressJson.title;
  }

  if (progress < 3) throw new Error("Konversi timeout (lebih dari 60 detik).");

  return { title, format: lowerFormat, downloadUrl };
}

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ status: "error", message: "Method not allowed" });
    return;
  }

  const { url, format } = req.query;

  if (!url) {
    res.status(400).json({ status: "error", message: "Parameter ?url= wajib diisi" });
    return;
  }

  try {
    const raw = await scrapeYtmp3(url, format || "mp4");
    const result = {
      title: raw.title || null,
      author: null,
      thumbnail: null,
      stats: null,
      media: raw.downloadUrl
        ? [{ type: raw.format === "mp3" ? "audio" : "video", url: raw.downloadUrl, label: raw.format.toUpperCase() }]
        : [],
    };
    res.status(200).json({ status: "success", result });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};
