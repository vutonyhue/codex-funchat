import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeContentType(input: unknown): string {
  if (typeof input !== "string") return "application/octet-stream";
  const t = input.trim();
  return t.length ? t : "application/octet-stream";
}

function sanitizeFilename(name: string): string {
  // Keep it simple and safe for URL paths. Preserve dots/dashes/spaces.
  return name.replace(/[^\w.\-()+\s]/g, "_").trim() || "file";
}

function encodeKeyPath(key: string): string {
  // Encode each segment so spaces/etc are safe but slashes are preserved.
  return key
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" });

  const accountId = Deno.env.get("CLOUDFLARE_R2_ACCOUNT_ID") || "";
  const bucket = Deno.env.get("CLOUDFLARE_R2_BUCKET") || "";
  const accessKeyId = Deno.env.get("CLOUDFLARE_R2_ACCESS_KEY_ID") || "";
  const secretAccessKey = Deno.env.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY") || "";
  const publicBase = Deno.env.get("CLOUDFLARE_R2_PUBLIC_URL") || "";

  const endpoint =
    Deno.env.get("CLOUDFLARE_R2_ENDPOINT") ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");

  if (!accountId || !bucket || !accessKeyId || !secretAccessKey || !publicBase || !endpoint) {
    return json(500, { ok: false, error: "MISSING_R2_SECRETS" });
  }

  const body = (await req.json().catch(() => null)) as any;
  const filename = typeof body?.filename === "string" ? body.filename : "";
  const sizeBytes = typeof body?.sizeBytes === "number" ? body.sizeBytes : null;
  const contentType = safeContentType(body?.contentType);

  if (!filename) return json(400, { ok: false, error: "filename_required" });

  // 4GB hard limit (acceptance requirement)
  const MAX = 4 * 1024 * 1024 * 1024;
  if (sizeBytes != null && sizeBytes > MAX) {
    return json(413, { ok: false, error: "file_too_large" });
  }

  // Key format: chat/<yyyy>/<mm>/<dd>/<uuid>_<sanitizedFilename>
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const rand = crypto.randomUUID();
  const safeName = sanitizeFilename(filename);
  const key = `chat/${yyyy}/${mm}/${dd}/${rand}_${safeName}`;

  const keyPath = encodeKeyPath(key);
  const objectUrl = `${endpoint.replace(/\/+$/, "")}/${bucket}/${keyPath}`;
  const publicUrl = `${publicBase.replace(/\/+$/, "")}/${keyPath}`;

  const aws = new AwsClient({
    accessKeyId,
    secretAccessKey,
    region: "auto",
    service: "s3",
  });

  // Presign a PUT (query-signed)
  const signed = await aws.sign(objectUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    aws: { signQuery: true },
  });

  return json(200, {
    ok: true,
    data: {
      uploadUrl: signed.url,
      publicUrl,
      key,
      contentType,
    },
  });
});

