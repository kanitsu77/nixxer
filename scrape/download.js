module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ status: "error", message: "Method not allowed" });
    return;
  }

  const { url, filename } = req.query;

  if (!url) {
    res.status(400).json({ status: "error", message: "Parameter ?url= wajib diisi" });
    return;
  }

  try {
    const upstream = await fetch(url);

    if (!upstream.ok) {
      throw new Error(`Gagal ambil file: HTTP ${upstream.status}`);
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safeName = (filename || "download").replace(/[^a-zA-Z0-9._-]/g, "_");

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    res.status(200).send(buffer);
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};
