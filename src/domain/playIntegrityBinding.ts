const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

async function sha256Base64Url(value: Uint8Array) {
  const exactBytes = Uint8Array.from(value).buffer;
  return base64Url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", exactBytes)),
  );
}

export async function handwritingAttestationRequestHash(
  image: Uint8Array,
  installationToken: string,
) {
  const imageDigest = await sha256Base64Url(image);
  return sha256Base64Url(
    encoder.encode(
      [
        "evoke-ink-handwriting-attestation-v1",
        "POST",
        "/api/transcriptions",
        installationToken,
        imageDigest,
      ].join("\n"),
    ),
  );
}
