// ===================== Cipher =====================

export async function cipher() {
  const ITERATIONS = 150000;
  const ROUNDS = 64;
  const SALT_BYTES = 16;
  const IV_BYTES = 12;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  function concatUint8(...parts) {
    const total = parts.reduce((s, p) => s + p.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const p of parts) {
      out.set(p, offset);
      offset += p.length;
    }
    return out;
  }
  function uint32ToBE(n) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n, false);
    return b;
  }
  function beToUint32(buf) {
    return new DataView(buf.buffer).getUint32(0, false);
  }
  function repeatToLength(src, len) {
    if (len === 0) return new Uint8Array(0);
    const out = new Uint8Array(len);
    let i = 0;
    while (i < len) {
      const take = Math.min(src.length, len - i);
      out.set(src.subarray(0, take), i);
      i += take;
    }
    return out;
  }
  function rotateLeft(u8, r) {
    const n = u8.length;
    if (n === 0) return u8;
    r = r % n;
    if (r === 0) return u8;
    return concatUint8(u8.subarray(r), u8.subarray(0, r));
  }
  function rotateRight(u8, r) {
    const n = u8.length;
    if (n === 0) return u8;
    r = r % n;
    if (r === 0) return u8;
    return concatUint8(u8.subarray(n - r), u8.subarray(0, n - r));
  }
  function toBase64Url(u8) {
    let s = "";
    const chunk = 0x8000;
    for (let i = 0; i < u8.length; i += chunk) s += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
    const b64 = btoa(s);
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function fromBase64Url(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    const str = atob(s);
    const arr = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i);
    return arr;
  }
  async function deriveBitsPBKDF2(password, salt, bits = 512) {
    const passKey = await crypto.subtle.importKey("raw", encoder.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]);
    const buf = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, passKey, bits);
    return new Uint8Array(buf);
  }
  async function deriveKeysFromTwoPasswords(pw1, pw2, salt1, salt2) {
    const bitsA = await deriveBitsPBKDF2(pw1, salt1, 512);
    const bitsB = await deriveBitsPBKDF2(pw2, salt2, 512);
    const combined = new Uint8Array(bitsA.length);
    for (let i = 0; i < combined.length; i++) combined[i] = bitsA[i] ^ bitsB[i];
    const aesRaw = combined.subarray(0, 32);
    const hmacRaw = combined.subarray(32, 64);
    const aesKey = await crypto.subtle.importKey("raw", aesRaw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    const hmacKey = await crypto.subtle.importKey("raw", hmacRaw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return { aesKey, hmacKey };
  }
  async function roundHMAC(hmacKey, roundIndex) {
    const msg = concatUint8(encoder.encode("round"), uint32ToBE(roundIndex));
    const sig = await crypto.subtle.sign("HMAC", hmacKey, msg);
    return new Uint8Array(sig);
  }
  function sumBytes(u8) {
    let s = 0;
    for (let i = 0; i < u8.length; i++) s += u8[i];
    return s;
  }
  async function encryptText(plainText, pw1, pw2) {
    const salt1 = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const salt2 = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const { aesKey, hmacKey } = await deriveKeysFromTwoPasswords(pw1, pw2, salt1, salt2);
    const data = encoder.encode(plainText);
    const stateHeader = uint32ToBE(data.length);
    let state = concatUint8(stateHeader, data);
    for (let r = 0; r < ROUNDS; r++) {
      const rk = await roundHMAC(hmacKey, r);
      const ks = repeatToLength(concatUint8(rk, iv), state.length);
      for (let i = 0; i < state.length; i++) state[i] ^= ks[i];
      const rot = sumBytes(rk) % (state.length || 1);
      state = rotateLeft(state, rot);
    }
    const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, state.buffer));
    const blob = concatUint8(salt1, salt2, iv, encrypted);
    return toBase64Url(blob);
  }
  function randomFake27() {
    const b = crypto.getRandomValues(new Uint8Array(20));
    let s = "";
    const chunk = 0x8000;
    for (let i = 0; i < b.length; i += chunk) s += String.fromCharCode.apply(null, b.subarray(i, i + chunk));
    const b64 = btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    if (b64.length >= 27) return b64.slice(0, 27);
    while (b64.length < 27) b64 += "-";
    return b64.slice(0, 27);
  }
  async function decryptText(token, pw1, pw2) {
    try {
      const blob = fromBase64Url(token);
      if (blob.length < SALT_BYTES + SALT_BYTES + IV_BYTES + 1) return randomFake27();
      const salt1 = blob.subarray(0, SALT_BYTES);
      const salt2 = blob.subarray(SALT_BYTES, SALT_BYTES + SALT_BYTES);
      const iv = blob.subarray(SALT_BYTES + SALT_BYTES, SALT_BYTES + SALT_BYTES + IV_BYTES);
      const ciphertext = blob.subarray(SALT_BYTES + SALT_BYTES + IV_BYTES);
      const { aesKey, hmacKey } = await deriveKeysFromTwoPasswords(pw1, pw2, salt1, salt2);
      let state;
      try {
        const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, ciphertext);
        state = new Uint8Array(plainBuf);
      } catch (e) {
        return randomFake27();
      }
      for (let r = ROUNDS - 1; r >= 0; r--) {
        const rk = await roundHMAC(hmacKey, r);
        const rot = sumBytes(rk) % (state.length || 1);
        state = rotateRight(state, rot);
        const ks = repeatToLength(concatUint8(rk, iv), state.length);
        for (let i = 0; i < state.length; i++) state[i] ^= ks[i];
      }
      if (state.length < 4) return randomFake27();
      const len = beToUint32(state.subarray(0, 4));
      const payload = state.subarray(4, 4 + len);
      return decoder.decode(payload);
    } catch (e) {
      return randomFake27();
    }
  }

  window.cipherSubmit = function () {
    const p1 = (document.getElementById("cipher_pw1") || {}).value || "";
    const p2 = (document.getElementById("cipher_pw2") || {}).value || "";
    const encBtn = document.getElementById("cipher_mode_encrypt");
    const mode = encBtn && encBtn.classList.contains("active") ? "encrypt" : "decrypt";
    closeModal({ action: "submit", pw1: p1, pw2: p2, mode });
  };

  window._cipherToggleMode = function (mode) {
    const encBtn = document.getElementById("cipher_mode_encrypt");
    const decBtn = document.getElementById("cipher_mode_decrypt");
    if (!encBtn || !decBtn) return;
    if (mode === "encrypt") {
      encBtn.classList.add("active");
      decBtn.classList.remove("active");
    } else {
      decBtn.classList.add("active");
      encBtn.classList.remove("active");
    }
  };

  const bodyHtml = `
  <div>
    <label class="modal-label">Enter Passkeys</label>
  </div>
  <div>
    <input id="cipher_pw1" placeholder="Key I">
  </div>
  <div>
    <input id="cipher_pw2" placeholder="Key II">
  </div>
  <div style="display: flex; gap: 8px; margin-top: 4px;">
    <button type="button" id="cipher_mode_encrypt" class="modal-btn active" onclick="window._cipherToggleMode('encrypt')">Encrypt</button>
    <button type="button" id="cipher_mode_decrypt" class="modal-btn" onclick="window._cipherToggleMode('decrypt')">Decrypt</button>
  </div>
`;

  const footerHtml = `<button onclick="closeModal()">Cancel</button><button onclick="window.cipherSubmit()" class="modal-btn">Cipher</button>`;

  const r = await showModal({
    header: `<div class="modal-title">Cipher</div>`,
    body: bodyHtml,
    footer: footerHtml
  });

  if (!r || r.action !== "submit") return;
  const pw1 = r.pw1 || "";
  const pw2 = r.pw2 || "";
  const mode = r.mode || "encrypt";
  const textareaEl = window.noteTextarea || document.querySelector("textarea");
  if (!textareaEl) return;
  const text = textareaEl.value || "";
  if (!pw1 || !pw2) {
    showNotification && showNotification("Both passwords are required");
    return;
  }
  try {
    if (mode === "encrypt") {
      const token = await encryptText(text, pw1, pw2);
      textareaEl.value = token;
      showNotification("Text encrypted");
    } else {
      const out = await decryptText(text, pw1, pw2);
      textareaEl.value = out;
      showNotification("Text decrypted");
    }
    typeof updateNoteMetadata === "function" && updateNoteMetadata();
  } catch (err) {
    textareaEl.value = randomFake27();
    showNotification("Text decrypted");
  }
}
