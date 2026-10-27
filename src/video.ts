export const VIDEO_CACHE = 'public, max-age=31536000, immutable';
export function videoURL(key: string): string | null {
  return /^demo\/videos\/[a-f0-9]{64}\.mp4$/.test(key) ? 'https://media.peach.video/' + key : null;
}
