import crypto from "crypto";

export const PHONEPE_BASE_URL =
  process.env.PHONEPE_ENV === "PRODUCTION"
    ? "https://api.phonepe.com/apis/hermes"
    : "https://api-preprod.phonepe.com/apis/pg-sandbox";

export const MERCHANT_ID   = process.env.PHONEPE_MERCHANT_ID!;
export const SALT_KEY      = process.env.PHONEPE_SALT_KEY!;
export const SALT_INDEX    = process.env.PHONEPE_SALT_INDEX ?? "1";

/** SHA256(base64payload + endpoint + saltKey) + "###" + saltIndex */
export function generateChecksum(base64Payload: string, endpoint: string): string {
  const str = base64Payload + endpoint + SALT_KEY;
  const hash = crypto.createHash("sha256").update(str).digest("hex");
  return `${hash}###${SALT_INDEX}`;
}

export function encodePayload(payload: object): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

export function verifyChecksum(base64Payload: string, endpoint: string, checksum: string): boolean {
  const expected = generateChecksum(base64Payload, endpoint);
  return expected === checksum;
}
