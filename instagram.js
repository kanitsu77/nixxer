const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");

const jar = new CookieJar();
const client = wrapper(
  axios.create({
    jar,
    withCredentials: true,
    maxRedirects: 10,
    timeout: 60000,
  })
);

const headers = {
  "user-agent":
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  "sec-ch-ua": '"Chromium";v="141", "Not?A_Brand";v="8"',
  "sec-ch-ua-mobile": "?1",
  "sec-ch-ua-platform": '"Android"',
  "sec-fetch-site": "none",
  "sec-fetch-mode": "navigate",
  "sec-fetch-user": "?1",
  "sec-fetch-dest": "document",
  "upgrade-insecure-requests": "1",
};

function extractShortcode(url) {
  const m = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

function unescapeUrl(url) {
  if (!url) return "";
  return url.replace(/\\u0026/g, "&").replace(/\\u00253D/g, "=").replace(/\\\//g, "/");
}

function extractMediaFromHTML(html, shortcode) {
  const marker = `"code":"${shortcode}`;
  let idx = html.indexOf(marker);

  if (idx === -1) {
    idx = html.indexOf(`"code":"${shortcode}"`);
  }
  if (idx === -1) {
    return null;
  }

  const searchBefore = html.lastIndexOf('"xig_polaris_media":', idx);
  if (searchBefore === -1) {
    return null;
  }

  const keyLength = '"xig_polaris_media":'.length;
  const jsonStart = html.indexOf("{", searchBefore + keyLength);
  if (jsonStart === -1) {
    return null;
  }

  let depth = 0;
  let end = -1;
  let inString = false;
  let escaped = false;
  const maxLength = Math.min(jsonStart + 1000000, html.length);

  for (let i = jsonStart; i < maxLength; i++) {
    const char = html[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  if (end === -1) {
    return null;
  }

  try {
    return JSON.parse(html.substring(jsonStart, end));
  } catch {
    return null;
  }
}

function extractTokensFromHTML(html) {
  const csrf = html.match(/"csrf_token":"([^"]+)"/);
  const lsd = html.match(/"LSD",\[\],\{"token":"([^"]+)"/);
  const relayAppId = html.match(/RelayAPIConfigDefaults[^}]*"X-IG-App-ID":"(\d+)"/);
  const appIdField = html.match(/"APP_ID":"(\d+)"/);

  return {
    csrfToken: csrf ? csrf[1] : "",
    lsd: lsd ? lsd[1] : "",
    appId: relayAppId ? relayAppId[1] : appIdField ? appIdField[1] : "936619743392459",
  };
}

function formatResult(data) {
  const post = data.if_not_gated_logged_out || data;
  const user = post.user || {};
  const caption = post.caption;
  const captionText = caption ? (typeof caption === "string" ? caption : caption.text || "") : "";
  const typename = post.__typename || "";
  const mediaType = post.media_type;
  const productType = post.product_type || "";

  let type = "photo";
  if (mediaType === 2 || typename.includes("Video")) {
    type = "video";
  }
  if (mediaType === 8 || typename.includes("Carousel") || productType === "carousel_container") {
    type = "slide";
  }

  const media = [];

  if (type === "slide" && post.carousel_media) {
    for (const item of post.carousel_media) {
      const isVideo = item.media_type === 2 || (item.__typename || "").includes("Video");

      if (isVideo && item.video_versions?.length) {
        const video = item.video_versions[0];
        media.push({
          type: "video",
          url: unescapeUrl(video.url),
          width: video.width || item.original_width || null,
          height: video.height || item.original_height || null,
        });
      } else {
        const candidates = (item.image_versions2 || {}).candidates || [];
        const best = candidates[0] || {};
        const url = unescapeUrl(best.url || item.display_uri || "");

        if (url) {
          media.push({
            type: "photo",
            url,
            width: best.width || item.original_width || null,
            height: best.height || item.original_height || null,
          });
        }
      }
    }
  } else if (type === "video") {
    const vv = post.video_versions || [];
    if (vv.length) {
      const video = vv[0];
      media.push({
        type: "video",
        url: unescapeUrl(video.url),
        width: video.width || post.original_width || null,
        height: video.height || post.original_height || null,
      });
    }
  } else {
    const candidates = (post.image_versions2 || {}).candidates || [];
    const best = candidates[0] || {};
    const url = unescapeUrl(best.url || post.display_uri || "");

    if (url) {
      media.push({
        type: "photo",
        url,
        width: best.width || post.original_width || null,
        height: best.height || post.original_height || null,
      });
    }
  }

  return {
    type,
    author: {
      username: user.username || "",
      name: user.full_name || "",
      id: user.pk || user.id || "",
      pp: unescapeUrl(user.profile_pic_url || ""),
    },
    caption: captionText,
    stats: {
      like: post.like_count || null,
      comments: post.comment_count || null,
      views: post.play_count || post.video_play_count || null,
      duration: post.video_duration || null,
    },
    uploadAt: post.taken_at ? new Date(post.taken_at * 1000).toLocaleString("id-ID") : null,
    media: media.length === 1 ? media[0].url : media.map((m) => m.url),
  };
}

function formatGraphQLResult(m) {
  const side = m.edge_sidecar_to_children?.edges || [];
  const mediaList = side.length
    ? side.map((x) => x.node.video_url || x.node.display_url)
    : m.video_url || m.display_url;

  let type = "photo";
  if (side.length) {
    type = "slide";
  } else if (m.is_video) {
    type = "video";
  }

  return {
    type,
    author: {
      username: m.owner?.username || "",
      name: m.owner?.full_name || "",
      id: m.owner?.id || "",
      pp: unescapeUrl(m.owner?.profile_pic_url || ""),
    },
    caption: m.edge_media_to_caption?.edges?.[0]?.node?.text || "",
    stats: {
      like: m.edge_media_preview_like?.count || null,
      comments: m.edge_media_preview_comment?.count || null,
      views: m.video_view_count || m.video_play_count || null,
      duration: m.video_duration || null,
    },
    media: Array.isArray(mediaList) ? mediaList.map((u) => unescapeUrl(u)) : unescapeUrl(mediaList),
  };
}

async function instagram(url) {
  const shortcode = extractShortcode(url);

  if (!shortcode) {
    return { success: false, message: "URL tidak valid, harus mengandung /p/ /reel/ atau /tv/" };
  }

  try {
    const pageRes = await client.get(`https://www.instagram.com/p/${shortcode}/`, { headers });
    const html = pageRes.data;

    const htmlData = extractMediaFromHTML(html, shortcode);
    if (htmlData) {
      return { success: true, ...formatResult(htmlData) };
    }

    const tokens = extractTokensFromHTML(html);
    const cookies = await jar.getCookies(`https://www.instagram.com/p/${shortcode}/`);
    const cookiesObj = {};
    cookies.forEach((cookie) => {
      cookiesObj[cookie.key] = cookie.value;
    });

    const gqlParams = new URLSearchParams({
      doc_id: "8845758582119845",
      variables: JSON.stringify({ shortcode }),
    });

    const gqlRes = await client.get(`https://www.instagram.com/graphql/query/?${gqlParams}`, {
      headers: {
        ...headers,
        "x-ig-app-id": tokens.appId,
        "x-csrftoken": tokens.csrfToken || cookiesObj.csrftoken || "",
        "x-fb-lsd": tokens.lsd,
        accept: "*/*",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty",
        referer: `https://www.instagram.com/p/${shortcode}/`,
      },
    });

    const json = gqlRes.data;
    const m = json.data?.xdt_shortcode_media;

    if (m) {
      return { success: true, ...formatGraphQLResult(m) };
    }

    return { success: false, message: json.message || "Data media tidak ditemukan" };
  } catch (e) {
    return {
      success: false,
      message: e.response ? `HTTP ${e.response.status}: ${e.response.statusText || "Request failed"}` : e.message,
    };
  }
}

function normalize(raw) {
  const mediaRaw = raw.media;
  const urls = Array.isArray(mediaRaw) ? mediaRaw : [mediaRaw].filter(Boolean);
  const media = urls.map((url, i) => ({
    type: raw.type === "video" ? "video" : "photo",
    url,
    label: urls.length > 1 ? `Item ${i + 1}` : raw.type === "video" ? "Video" : "Gambar",
  }));

  return {
    title: raw.caption || null,
    author: raw.author?.username ? `@${raw.author.username}` : null,
    thumbnail: raw.author?.pp || null,
    stats: raw.stats
      ? { like: raw.stats.like, comment: raw.stats.comments, views: raw.stats.views }
      : null,
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

  const raw = await instagram(url);

  if (!raw.success) {
    res.status(500).json({ status: "error", message: raw.message });
    return;
  }

  res.status(200).json({ status: "success", result: normalize(raw) });
};
