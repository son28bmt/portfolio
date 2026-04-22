const path = require("path");
const { randomUUID } = require("crypto");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const getR2Config = () => {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME || "portfolio";
  const endpoint =
    process.env.R2_S3_ENDPOINT ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  const publicBaseUrl =
    process.env.R2_PUBLIC_BASE_URL ||
    (accountId ? `https://${bucket}.${accountId}.r2.dev` : "");

  if (
    !accountId ||
    !accessKeyId ||
    !secretAccessKey ||
    !endpoint ||
    !publicBaseUrl
  ) {
    throw new Error(
      "Cấu hình R2 chưa đầy đủ. Vui lòng kiểm tra biến môi trường R2_*.",
    );
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint,
    publicBaseUrl: publicBaseUrl.replace(/\/+$/, ""),
  };
};

let s3Client;

const getS3Client = () => {
  if (s3Client) return s3Client;

  const config = getR2Config();
  s3Client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return s3Client;
};

const safeExtension = (fileName = "", mimeType = "") => {
  const normalizedFileName = typeof fileName === "string" ? fileName : "";
  const normalizedMimeType =
    typeof mimeType === "string" ? mimeType.toLowerCase() : "";
  const extFromName = path.extname(normalizedFileName).toLowerCase();
  if (extFromName) return extFromName;

  const fallbackMap = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/avif": ".avif",
    "application/vnd.android.package-archive": ".apk",
    "application/octet-stream": ".ipa",
  };

  return fallbackMap[normalizedMimeType] || ".jpg";
};

const safeFolder = (folder = "projects") => {
  const cleaned = String(folder || "projects")
    .replace(/[^a-zA-Z0-9/_-]/g, "")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "");

  return cleaned || "projects";
};

const uploadBufferToR2 = async ({
  buffer,
  originalName,
  mimeType,
  folder = "projects",
}) => {
  const config = getR2Config();
  const client = getS3Client();
  const ext = safeExtension(originalName, mimeType);
  const cleanFolder = safeFolder(folder);
  const fileKey = `${cleanFolder}/${Date.now()}-${randomUUID()}${ext}`;

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: fileKey,
      Body: buffer,
      ContentType: mimeType,
    }),
  );

  return `${config.publicBaseUrl}/${fileKey}`;
};

const getPresignedUploadUrl = async ({
  fileName,
  mimeType,
  folder = "projects",
}) => {
  const config = getR2Config();
  const client = getS3Client();
  const cleanFolder = safeFolder(folder);
  const ext = safeExtension(fileName, mimeType);
  const fileKey = `${cleanFolder}/${Date.now()}-${randomUUID()}${ext}`;
  const rawExpires = Number(process.env.R2_PRESIGN_EXPIRES_SECONDS || 900);
  const expiresIn = Number.isFinite(rawExpires)
    ? Math.min(3600, Math.max(60, rawExpires))
    : 900;

  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: fileKey,
      ContentType: mimeType,
    }),
    { expiresIn },
  );

  return {
    uploadUrl,
    publicUrl: `${config.publicBaseUrl}/${fileKey}`,
    fileKey,
  };
};

module.exports = {
  uploadBufferToR2,
  getPresignedUploadUrl,
  uploadImageBufferToR2: uploadBufferToR2, // Alias for backward compatibility
};
