import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { requireThat } from './money.mjs';
const derive = promisify(scrypt),
  params = {
    N: 131072,
    r: 8,
    p: 1,
    maxmem: 256 * 1024 * 1024
  };
let running = 0;
const queue = [];
async function bounded(fn) {
  requireThat(running < 2 || queue.length < 4, 'Sign-in is busy. Try again shortly.', 429);
  if (running >= 2) await new Promise(resolve => queue.push(resolve));else running++;
  try {
    return await fn();
  } finally {
    if (queue.length) queue.shift()();else running--;
  }
}
export function passwordValue(value, {
  newPassword = false
} = {}) {
  requireThat(typeof value === 'string' && [...value].length <= 128, 'Use a password of 15 to 128 characters.');
  const normalized = value.normalize('NFC');
  if (newPassword) {
    requireThat([...normalized].length >= 15, 'Use at least 15 characters. A memorable passphrase works well.');
    const compact = normalized.toLowerCase().replace(/\s/g, '');
    requireThat(!['passwordpassword', 'passwordpassword1', 'password123456789', '123456789012345', 'qwertyuiopasdfgh', 'buildererpbuildererp', 'adminadminadmin'].includes(compact) && !/^(.{1,5})\1{2,}$/.test(compact), 'Choose a less predictable passphrase.');
  }
  return normalized;
}
export async function hashPassword(value) {
  const password = passwordValue(value, {
      newPassword: true
    }),
    salt = randomBytes(16);
  return bounded(async () => `scrypt$131072$8$1$${salt.toString('base64url')}$${(await derive(password, salt, 64, params)).toString('base64url')}`);
}
export async function verifyPassword(value, encoded) {
  let password;
  try {
    password = passwordValue(value);
  } catch {
    return false;
  }
  const parts = typeof encoded === 'string' ? encoded.split('$') : [];
  const valid = parts.length === 6 && parts[0] === 'scrypt' && parts[1] === '131072' && parts[2] === '8' && parts[3] === '1';
  const salt = valid ? Buffer.from(parts[4], 'base64url') : Buffer.alloc(16, 0x35),
    expected = valid ? Buffer.from(parts[5], 'base64url') : Buffer.alloc(64);
  const actual = await bounded(() => derive(password, salt, 64, params));
  return valid && expected.length === actual.length && timingSafeEqual(actual, expected);
}
