const Crypto = {
  iterations: 600000,

  async generateKey() {
    return crypto.getRandomValues(new Uint8Array(32));
  },

  async deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    const baseKey = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const keyBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: this.iterations,
        hash: 'SHA-256'
      },
      baseKey,
      256
    );

    return new Uint8Array(keyBits);
  },

  async encrypt(plaintext, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const plaintextBuffer = encoder.encode(plaintext);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      cryptoKey,
      plaintextBuffer
    );

    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return combined;
  },

  async decrypt(combined, key) {
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const plaintextBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      cryptoKey,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(plaintextBuffer);
  },

  bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  },

  base64ToBuffer(base64) {
    const padding = '='.repeat((4 - base64.length % 4) % 4);
    const base64Std = base64.replace(/-/g, '+').replace(/_/g, '/') + padding;
    const binary = atob(base64Std);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  },

  generateSalt() {
    return crypto.getRandomValues(new Uint8Array(16));
  }
};