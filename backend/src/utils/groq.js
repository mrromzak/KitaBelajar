/**
 * Groq API utility dengan dual-key fallback.
 *
 * Cara kerja:
 *  1. Coba dengan GROQ_API_KEY (primary)
 *  2. Jika 429 (rate limit) → otomatis retry dengan GROQ_API_KEY_2 (backup)
 *  3. Jika key ke-2 juga 429 → lempar error RateLimitError
 *
 * Setup di .env:
 *   GROQ_API_KEY=gsk_xxx...       ← API key utama
 *   GROQ_API_KEY_2=gsk_yyy...     ← API key backup (opsional)
 *   GROQ_MODEL=llama-3.1-8b-instant
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

class RateLimitError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'RateLimitError';
    this.isRateLimit = true;
  }
}

/**
 * Panggil Groq dengan satu API key.
 * @returns {Promise<{ok: boolean, status: number, data: object}>}
 */
async function callGroqKey(apiKey, payload) {
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

/**
 * Strip tag <think>...</think> dari respons model reasoning.
 */
function stripThink(text) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*/i, '')
    .trim();
}

/**
 * Panggil Groq dengan auto-fallback ke key ke-2 jika kena rate limit.
 *
 * @param {object} payload  - Body request ke Groq (model, messages, max_tokens, dll)
 * @returns {Promise<object>} - Response data dari Groq (choices, usage, dll)
 * @throws {RateLimitError}  - Jika semua key kena rate limit
 * @throws {Error}           - Jika ada error lain (bukan 429)
 */
async function callGroq(payload) {
  const keys = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2
  ].filter(Boolean); // filter yang undefined/kosong

  if (keys.length === 0) {
    throw new Error('GROQ_API_KEY belum diset di server.');
  }

  let lastRateLimitMsg = 'Rate limit Groq tercapai di semua API key.';

  for (let i = 0; i < keys.length; i++) {
    const keyLabel = i === 0 ? 'primary' : `backup-${i}`;
    try {
      const { ok, status, data } = await callGroqKey(keys[i], payload);

      if (ok) {
        // Sukses — strip <think> jika ada
        if (data.choices?.[0]?.message?.content) {
          data.choices[0].message.content = stripThink(data.choices[0].message.content);
        }
        if (i > 0) {
          console.info(`[Groq] Berhasil menggunakan ${keyLabel} key setelah key sebelumnya rate limit.`);
        }
        return data;
      }

      if (status === 429) {
        const retryAfter = data.error?.message || 'rate limit tercapai';
        console.warn(`[Groq] Key ${keyLabel} kena rate limit (429): ${retryAfter}`);
        lastRateLimitMsg = retryAfter;
        // Lanjut ke key berikutnya
        continue;
      }

      // Error lain (bukan 429) — langsung throw, tidak perlu coba key lain
      console.error(`[Groq] Error dari key ${keyLabel}:`, JSON.stringify(data.error));
      throw new Error(data.error?.message || `Groq API error (${status})`);

    } catch (err) {
      if (err.isRateLimit) throw err; // sudah di-wrap, lempar langsung
      if (i < keys.length - 1) {
        // Error jaringan/timeout — coba key berikutnya
        console.warn(`[Groq] Key ${keyLabel} gagal (${err.message}), mencoba key backup...`);
        continue;
      }
      throw err;
    }
  }

  // Semua key sudah dicoba, semua kena rate limit
  throw new RateLimitError(lastRateLimitMsg);
}

module.exports = { callGroq, RateLimitError };
