/** The next of their prayer times after now ("HH:MM" strings, local). */
export function nextTime<T extends { at: string }>(times: T[], now: Date = new Date()): T | null {
  if (times.length === 0) return null;
  const mins = (hm: string) => {
    const [h, m] = hm.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  const current = now.getHours() * 60 + now.getMinutes();
  const sorted = [...times].sort((a, b) => mins(a.at) - mins(b.at));
  return sorted.find((t) => mins(t.at) > current) ?? sorted[0]!;
}

/** "07:00" → "7:00 am" (or the device's own style). */
export function showTime(hm: string): string {
  const [h, m] = hm.split(':').map(Number);
  const d = new Date(2000, 0, 1, h ?? 0, m ?? 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
