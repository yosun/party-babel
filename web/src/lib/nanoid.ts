export function nanoid(size = 21): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  let result = '';
  for (let i = 0; i < size; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}
