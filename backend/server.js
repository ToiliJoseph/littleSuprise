const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const FRONTEND_DIR = path.resolve(__dirname, "..", "frontend");
const UPLOADS_DIR = path.join(FRONTEND_DIR, "uploads");
const ADMIN_CONFIG_PATH = path.join(__dirname, ".admin-config.json");
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const MAX_REQUEST_BYTES = 68 * 1024 * 1024;
const MAX_FILES = 10;
const MAX_UPLOAD_FILES_PER_HOUR = 90;
const MAX_UPLOAD_BYTES_PER_HOUR = 450 * 1024 * 1024;
const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;
const ADMIN_LOGIN_LIMIT = 5;
const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const uploadAttempts = new Map();
const adminSessions = new Map();
const adminLoginAttempts = new Map();
let adminPasswordVerifier = null;

const audioFormats = [
    { extension: ".mp3", alternateExtensions: [".mp2", ".mpga"], type: "audio/mpeg", aliases: ["audio/mpeg", "audio/mp3"] },
    { extension: ".m4a", alternateExtensions: [".m4b"], type: "audio/mp4", aliases: ["audio/mp4", "audio/x-m4a", "audio/m4a"] },
    { extension: ".aac", type: "audio/aac", aliases: ["audio/aac", "audio/aacp", "audio/x-aac"] },
    { extension: ".ogg", alternateExtensions: [".oga"], type: "audio/ogg", aliases: ["audio/ogg", "application/ogg", "audio/vorbis", "audio/x-vorbis"] },
    { extension: ".opus", type: "audio/ogg", aliases: ["audio/opus", "audio/x-opus+ogg"] },
    { extension: ".wav", alternateExtensions: [".wave"], type: "audio/wav", aliases: ["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"] },
    { extension: ".flac", type: "audio/flac", aliases: ["audio/flac", "audio/x-flac"] },
    { extension: ".wma", type: "audio/x-ms-wma", aliases: ["audio/x-ms-wma", "audio/vnd.ms-asf"] },
    { extension: ".aiff", alternateExtensions: [".aif", ".aifc"], type: "audio/aiff", aliases: ["audio/aiff", "audio/x-aiff", "audio/aifc"] },
    { extension: ".amr", type: "audio/amr", aliases: ["audio/amr"] },
    { extension: ".mid", alternateExtensions: [".midi"], type: "audio/midi", aliases: ["audio/midi", "audio/x-midi", "application/x-midi"] },
    { extension: ".ac3", type: "audio/ac3", aliases: ["audio/ac3", "audio/eac3"] },
    { extension: ".ape", type: "audio/ape", aliases: ["audio/ape", "audio/x-ape"] },
    { extension: ".caf", type: "audio/x-caf", aliases: ["audio/x-caf"] },
    { extension: ".weba", type: "audio/webm", aliases: ["audio/webm"] },
    { extension: ".mka", type: "audio/x-matroska", aliases: ["audio/x-matroska"] },
    { extension: ".mpc", type: "audio/x-musepack", aliases: ["audio/x-musepack"] }
];
const audioFormatsByExtension = new Map(audioFormats.flatMap(format =>
    [format.extension, ...(format.alternateExtensions || [])].map(extension => [extension, format])
));
const audioFormatsByMime = new Map(audioFormats.flatMap(format => format.aliases.map(type => [type, format])));

const categories = {
    memories: { directory: "memories", types: ["image/jpeg", "image/png", "image/webp", "image/gif"], maxBytes: 12 * 1024 * 1024 },
    her: { directory: "her", types: ["image/jpeg", "image/png", "image/webp", "image/gif"], maxBytes: 12 * 1024 * 1024 },
    him: { directory: "him", types: ["image/jpeg", "image/png", "image/webp", "image/gif"], maxBytes: 12 * 1024 * 1024 },
    dances: { directory: "dances", types: ["video/mp4", "video/webm"], maxBytes: 40 * 1024 * 1024 },
    music: { directory: "music", types: audioFormats.map(format => format.type), maxBytes: 20 * 1024 * 1024 }
};

const extensions = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/aac": ".aac",
    "audio/flac": ".flac",
    "audio/x-ms-wma": ".wma",
    "audio/aiff": ".aiff",
    "audio/amr": ".amr",
    "audio/midi": ".mid",
    "audio/ac3": ".ac3",
    "audio/ape": ".ape",
    "audio/x-caf": ".caf",
    "audio/webm": ".weba",
    "audio/x-matroska": ".mka",
    "audio/x-musepack": ".mpc"
};

const contentTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".aac": "audio/aac",
    ".opus": "audio/ogg",
    ".oga": "audio/ogg",
    ".flac": "audio/flac",
    ".wma": "audio/x-ms-wma",
    ".aif": "audio/aiff",
    ".aiff": "audio/aiff",
    ".amr": "audio/amr",
    ".mid": "audio/midi",
    ".midi": "audio/midi",
    ".ac3": "audio/ac3",
    ".ape": "audio/ape",
    ".caf": "audio/x-caf",
    ".weba": "audio/webm",
    ".mka": "audio/x-matroska",
    ".mpc": "audio/x-musepack",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon"
};

function sendJson(response, status, data) {
    response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
    });
    response.end(JSON.stringify(data));
}

function isSameOrigin(request) {
    const origin = request.headers.origin;
    const host = request.headers.host;
    if (!origin || !host) return false;
    try {
        const originUrl = new URL(origin);
        const expectedProtocol = request.socket.encrypted ? "https:" : "http:";
        return originUrl.protocol === expectedProtocol && originUrl.host.toLowerCase() === host.toLowerCase();
    } catch {
        return false;
    }
}

function getAdminSession(request) {
    const cookieHeader = request.headers.cookie || "";
    const sessionCookie = cookieHeader.split(";").map(cookie => cookie.trim()).find(cookie => cookie.startsWith("mon_amour_admin="));
    const token = sessionCookie?.slice("mon_amour_admin=".length);
    if (!token) return null;
    const expiresAt = adminSessions.get(token);
    if (!expiresAt || expiresAt <= Date.now()) {
        adminSessions.delete(token);
        return null;
    }
    return token;
}

function safeEqualHex(left, right) {
    if (!/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) return false;
    const leftBuffer = Buffer.from(left, "hex");
    const rightBuffer = Buffer.from(right, "hex");
    return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

async function loadAdminPasswordVerifier() {
    let configText;
    try {
        configText = await fs.promises.readFile(ADMIN_CONFIG_PATH, "utf8");
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
        console.warn("Owner photo removal is disabled: backend/.admin-config.json is not configured.");
        return;
    }
    const config = JSON.parse(configText);
    if (typeof config.salt !== "string" || typeof config.hash !== "string" ||
        !/^[a-f0-9]{32}$/i.test(config.salt) || !/^[a-f0-9]{128}$/i.test(config.hash)) {
        throw new Error("The private admin password configuration is invalid.");
    }
    adminPasswordVerifier = config;
}

function readJson(request, limit = MAX_REQUEST_BYTES) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        let tooLarge = false;
        request.on("data", chunk => {
            size += chunk.length;
            if (size > limit) tooLarge = true;
            else if (!tooLarge) chunks.push(chunk);
        });
        request.on("end", () => {
            if (tooLarge) {
                reject(Object.assign(new Error("Request body is too large."), { status: 413 }));
                return;
            }
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
            } catch {
                reject(Object.assign(new Error("Request body must be valid JSON."), { status: 400 }));
            }
        });
        request.on("error", reject);
    });
}

function fileSignatureMatches(type, buffer) {
    if (type === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (type === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (type === "image/gif") return buffer.subarray(0, 6).toString("ascii").match(/^GIF8[79]a$/) !== null;
    if (type === "image/webp") return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
    if (type === "video/webm" || type === "audio/webm" || type === "audio/x-matroska") return buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    if (type === "video/mp4" || type === "audio/mp4") return buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp";
    if (type === "audio/ogg") return buffer.toString("ascii", 0, 4) === "OggS";
    if (type === "audio/wav" || type === "audio/x-wav") return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WAVE";
    if (type === "audio/mpeg") {
        let start = 0;
        if (buffer.toString("ascii", 0, 3) === "ID3" && buffer.length >= 10) {
            const tagSize = buffer[6] * 0x200000 + buffer[7] * 0x4000 + buffer[8] * 0x80 + buffer[9];
            if ((buffer[6] | buffer[7] | buffer[8] | buffer[9]) < 128) {
                start = 10 + tagSize + ((buffer[5] & 0x10) ? 10 : 0);
            }
        }
        const scanEnd = Math.min(buffer.length - 3, start + 1024 * 1024);
        for (let index = start; index < scanEnd; index += 1) {
            if (buffer[index] !== 0xff || (buffer[index + 1] & 0xe0) !== 0xe0) continue;
            const version = (buffer[index + 1] >> 3) & 3;
            const layer = (buffer[index + 1] >> 1) & 3;
            const bitrate = (buffer[index + 2] >> 4) & 15;
            const sampleRate = (buffer[index + 2] >> 2) & 3;
            if (version !== 1 && layer !== 0 && bitrate !== 0 && bitrate !== 15 && sampleRate !== 3) return true;
        }
        return false;
    }
    if (type === "audio/aac") return buffer.toString("ascii", 0, 4) === "ADIF" || (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xf6) === 0xf0);
    if (type === "audio/flac") return buffer.toString("ascii", 0, 4) === "fLaC";
    if (type === "audio/x-ms-wma") return buffer.length >= 16 && buffer.subarray(0, 16).equals(Buffer.from([0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11, 0xa6, 0xd9, 0x00, 0xaa, 0x00, 0x62, 0xce, 0x6c]));
    if (type === "audio/aiff") return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "FORM" && ["AIFF", "AIFC"].includes(buffer.toString("ascii", 8, 12));
    if (type === "audio/amr") return buffer.toString("ascii", 0, 6) === "#!AMR\n" || buffer.toString("ascii", 0, 9) === "#!AMR-WB\n";
    if (type === "audio/midi") return buffer.toString("ascii", 0, 4) === "MThd";
    if (type === "audio/ac3") return buffer.length >= 2 && buffer[0] === 0x0b && buffer[1] === 0x77;
    if (type === "audio/ape") return buffer.toString("ascii", 0, 4) === "MAC ";
    if (type === "audio/x-caf") return buffer.toString("ascii", 0, 4) === "caff";
    if (type === "audio/x-musepack") return buffer.toString("ascii", 0, 3) === "MP+" || buffer.toString("ascii", 0, 4) === "MPCK";
    return false;
}

function resolveAudioFormat(type, name) {
    return audioFormatsByMime.get(type) || audioFormatsByExtension.get(path.extname(name).toLowerCase());
}

async function handleApi(request, response, url) {
    if (request.method === "GET" && url.pathname === "/api/media") {
        const media = [];
        for (const [category, config] of Object.entries(categories)) {
            const directory = path.join(UPLOADS_DIR, config.directory);
            let names;
            try {
                names = await fs.promises.readdir(directory);
            } catch (error) {
                if (error.code === "ENOENT") continue;
                throw error;
            }
            for (const name of names) {
                if (!/^[a-f0-9-]+\.[a-z0-9]+$/i.test(name)) continue;
                const filePath = path.join(directory, name);
                const stat = await fs.promises.stat(filePath);
                if (!stat.isFile()) continue;
                media.push({
                    category,
                    filename: name,
                    name: "",
                    type: contentTypes[path.extname(name).toLowerCase()] || "application/octet-stream",
                    url: `/uploads/${config.directory}/${encodeURIComponent(name)}`,
                    updatedAt: stat.mtimeMs
                });
            }
        }
        media.sort((a, b) => b.updatedAt - a.updatedAt);
        return sendJson(response, 200, media);
    }

    if (request.method === "GET" && url.pathname === "/api/admin/session") {
        return sendJson(response, 200, { authenticated: Boolean(getAdminSession(request)) });
    }

    if (request.method === "POST" && url.pathname === "/api/admin/login") {
        if (!isSameOrigin(request)) return sendJson(response, 403, { error: "Sign-in must come from this website." });
        if (!adminPasswordVerifier) return sendJson(response, 503, { error: "Owner photo removal is not configured on this server." });
        const ip = request.socket.remoteAddress || "unknown";
        const now = Date.now();
        const attempt = adminLoginAttempts.get(ip);
        if (attempt && attempt.windowStart > now - ADMIN_LOGIN_WINDOW_MS && attempt.count >= ADMIN_LOGIN_LIMIT) {
            return sendJson(response, 429, { error: "Too many password attempts. Please wait 15 minutes and try again." });
        }
        const body = await readJson(request, 2048);
        if (!body || typeof body.password !== "string" || body.password.length > 1024) {
            return sendJson(response, 400, { error: "Enter the admin password." });
        }
        const hash = crypto.scryptSync(body.password, Buffer.from(adminPasswordVerifier.salt, "hex"), 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString("hex");
        if (!safeEqualHex(hash, adminPasswordVerifier.hash)) {
            adminLoginAttempts.set(ip, attempt && attempt.windowStart > now - ADMIN_LOGIN_WINDOW_MS
                ? { windowStart: attempt.windowStart, count: attempt.count + 1 }
                : { windowStart: now, count: 1 });
            return sendJson(response, 401, { error: "That password is not correct." });
        }
        adminLoginAttempts.delete(ip);
        const token = crypto.randomBytes(32).toString("base64url");
        adminSessions.set(token, now + ADMIN_SESSION_MS);
        response.setHeader("Set-Cookie", `mon_amour_admin=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${Math.floor(ADMIN_SESSION_MS / 1000)}${request.socket.encrypted ? "; Secure" : ""}`);
        return sendJson(response, 200, { authenticated: true });
    }

    if (request.method === "POST" && url.pathname === "/api/admin/logout") {
        if (!isSameOrigin(request)) return sendJson(response, 403, { error: "Sign-out must come from this website." });
        const token = getAdminSession(request);
        if (token) adminSessions.delete(token);
        response.setHeader("Set-Cookie", "mon_amour_admin=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0");
        return sendJson(response, 200, { authenticated: false });
    }

    if (request.method === "POST" && url.pathname === "/api/media/delete") {
        if (!isSameOrigin(request)) return sendJson(response, 403, { error: "Photo removal must come from this website." });
        if (!getAdminSession(request)) return sendJson(response, 401, { error: "Sign in as the owner before removing photos." });
        const body = await readJson(request, 2048);
        const config = body && ["memories", "her", "him"].includes(body.category) ? categories[body.category] : null;
        if (!config || typeof body.filename !== "string" || !/^[a-f0-9-]+\.(jpg|png|webp|gif)$/i.test(body.filename)) {
            return sendJson(response, 400, { error: "Choose a valid uploaded photo to remove." });
        }
        const filePath = path.join(UPLOADS_DIR, config.directory, body.filename);
        try {
            await fs.promises.unlink(filePath);
        } catch (error) {
            if (error.code === "ENOENT") return sendJson(response, 404, { error: "That photo is no longer in the gallery." });
            throw error;
        }
        return sendJson(response, 200, { removed: true });
    }

    if (request.method === "POST" && url.pathname === "/api/upload") {
        const ip = request.socket.remoteAddress || "unknown";
        const now = Date.now();
        const attempt = uploadAttempts.get(ip);
        const body = await readJson(request);
        if (!body || !Array.isArray(body.files) || body.files.length < 1 || body.files.length > MAX_FILES) {
            return sendJson(response, 400, { error: `Choose between 1 and ${MAX_FILES} files per upload.` });
        }
        const withinUploadWindow = attempt && attempt.windowStart > now - 60 * 60 * 1000;
        if (withinUploadWindow && attempt.count + body.files.length > MAX_UPLOAD_FILES_PER_HOUR) {
            return sendJson(response, 429, { error: "This connection has reached its hourly limit of 90 files. Please try again later." });
        }
        const config = categories[body.category];
        if (!config) return sendJson(response, 400, { error: "Choose a valid upload section." });

        const prepared = [];
        let totalBytes = 0;
        for (const file of body.files) {
            if (!file || typeof file.name !== "string" || typeof file.type !== "string" || typeof file.data !== "string") {
                return sendJson(response, 400, { error: "Each file must include a name, type, and base64 data." });
            }
            const suppliedType = file.type.toLowerCase();
            const audioFormat = body.category === "music" ? resolveAudioFormat(suppliedType, file.name) : null;
            const type = audioFormat ? audioFormat.type : suppliedType;
            if (!config.types.includes(type)) return sendJson(response, 415, { error: body.category === "music"
                ? "That audio format is not supported. Supported formats include MP3, M4A, AAC, OGG/Opus, WAV, FLAC, WMA, AIFF, AMR, MIDI, AC3, APE, CAF, WebM, Matroska, and Musepack."
                : `That file type is not allowed in ${body.category}.` });
            if (!/^[A-Za-z0-9+/]*={0,2}$/.test(file.data)) return sendJson(response, 400, { error: "One of the files was not encoded correctly." });
            const buffer = Buffer.from(file.data, "base64");
            if (!buffer.length || buffer.toString("base64") !== file.data) return sendJson(response, 400, { error: "One of the files was not encoded correctly." });
            if (buffer.length > config.maxBytes) return sendJson(response, 413, { error: `Each file in this section must be smaller than ${Math.floor(config.maxBytes / (1024 * 1024))} MB.` });
            if (!fileSignatureMatches(type, buffer)) return sendJson(response, 415, { error: `${file.name} does not appear to be a valid ${type} file.` });
            totalBytes += buffer.length;
            prepared.push({
                type,
                extension: audioFormat?.extension,
                buffer,
                name: file.name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 100)
            });
        }
        if (totalBytes > 50 * 1024 * 1024) return sendJson(response, 413, { error: "The files together must be smaller than 50 MB." });
        if (withinUploadWindow && attempt.bytes + totalBytes > MAX_UPLOAD_BYTES_PER_HOUR) {
            return sendJson(response, 429, { error: "This connection has reached its hourly upload-size limit. Please try again later." });
        }

        const directory = path.join(UPLOADS_DIR, config.directory);
        await fs.promises.mkdir(directory, { recursive: true });
        const saved = [];
        for (const file of prepared) {
            const filename = `${crypto.randomUUID()}${file.extension || extensions[file.type]}`;
            await fs.promises.writeFile(path.join(directory, filename), file.buffer, { flag: "wx" });
            saved.push({ category: body.category, name: file.name, url: `/uploads/${config.directory}/${filename}` });
        }
        uploadAttempts.set(ip, withinUploadWindow
            ? { windowStart: attempt.windowStart, count: attempt.count + saved.length, bytes: attempt.bytes + totalBytes }
            : { windowStart: now, count: saved.length, bytes: totalBytes });
        return sendJson(response, 201, { uploaded: saved.length, files: saved });
    }

    return sendJson(response, 404, { error: "Not found." });
}

async function serveStatic(request, response, url) {
    let pathname;
    try {
        pathname = decodeURIComponent(url.pathname);
    } catch {
        response.writeHead(400);
        return response.end("Invalid path.");
    }
    if (pathname === "/") pathname = "/index.html";
    const filePath = path.resolve(FRONTEND_DIR, `.${pathname}`);
    if (!filePath.startsWith(FRONTEND_DIR + path.sep)) {
        response.writeHead(403);
        return response.end("Forbidden.");
    }
    try {
        const stat = await fs.promises.stat(filePath);
        if (!stat.isFile()) {
            response.writeHead(404);
            return response.end("Not found.");
        }
        const type = contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
        response.writeHead(200, {
            "Content-Type": type,
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Cache-Control": filePath.startsWith(UPLOADS_DIR) ? "public, max-age=31536000, immutable" : "no-cache"
        });
        if (request.method === "HEAD") return response.end();
        fs.createReadStream(filePath).pipe(response);
    } catch (error) {
        if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found.");
    }
}

async function start() {
    if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
        throw new Error("PORT must be a valid port number.");
    }
    await loadAdminPasswordVerifier();
    await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });

    const server = http.createServer(async (request, response) => {
        try {
            const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
            if (url.pathname.startsWith("/api/")) {
                await handleApi(request, response, url);
            } else if (request.method === "GET" || request.method === "HEAD") {
                await serveStatic(request, response, url);
            } else {
                response.writeHead(405, { Allow: "GET, HEAD" });
                response.end("Method not allowed.");
            }
        } catch (error) {
            console.error("Request failed:", error);
            if (!response.headersSent) sendJson(response, error.status || 500, { error: error.status ? error.message : "The server could not complete that request." });
            else response.destroy();
        }
    });

    const cleanup = setInterval(() => {
        const cutoff = Date.now() - 60 * 60 * 1000;
        for (const [ip, attempt] of uploadAttempts) if (attempt.windowStart <= cutoff) uploadAttempts.delete(ip);
        for (const [ip, attempt] of adminLoginAttempts) if (attempt.windowStart <= Date.now() - ADMIN_LOGIN_WINDOW_MS) adminLoginAttempts.delete(ip);
        for (const [token, expiresAt] of adminSessions) if (expiresAt <= Date.now()) adminSessions.delete(token);
    }, 15 * 60 * 1000);
    cleanup.unref();

    server.listen(PORT, HOST, () => {
        console.log(`Mon Amour is ready at http://${HOST}:${PORT}`);
        console.log("Uploaded photos, videos, and music are stored in frontend/uploads.");
    });
}

start().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});