export const STATUS_URL = 'https://api.squeekchain.com/v1/status';
export interface WheelData { rpm: number; state: string; observedAt: number; bpm: number }
export function parseWheel(body: unknown, now = Date.now()): WheelData {
  if (!body || typeof body !== 'object' || !('measurement' in body)) throw new Error('The wheel sent an unreadable measurement.');
  const m = (body as { measurement: Record<string, unknown> }).measurement;
  if (!m || typeof m !== 'object' || typeof m.rpmMilli !== 'number' || !Number.isFinite(m.rpmMilli) || m.rpmMilli < 0 || !Number.isSafeInteger(m.rpmMilli)) throw new Error('The wheel sent an invalid RPM measurement.');
  if (typeof m.coreStatus !== 'string' || !/^[A-Z][A-Z_]{1,31}$/.test(m.coreStatus)) throw new Error('The wheel sent an invalid wheel state.');
  if (typeof m.observedAt !== 'string') throw new Error('The wheel did not include an observation time.');
  const observedAt = Date.parse(m.observedAt);
  if (!Number.isFinite(observedAt) || observedAt > now + 5000) throw new Error('The wheel sent an invalid observation time.');
  const rpm = m.rpmMilli / 1000;
  return { rpm, state: m.coreStatus, observedAt, bpm: Math.min(140, Math.max(75, 80 + rpm)) };
}
export function isFresh(data: WheelData, now = Date.now()) { return now - data.observedAt <= 60_000 && data.observedAt <= now + 5000; }
export async function fetchWheel(fetcher: typeof fetch = fetch, timeout = 7000, signal?: AbortSignal): Promise<WheelData> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, timeout);
  try {
    const res = await fetcher(STATUS_URL, { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('The wheel service is unavailable.');
    return parseWheel(await res.json());
  } catch (error) {
    if (controller.signal.aborted) throw new Error('The wheel did not respond within 7 seconds.');
    if (error instanceof Error && error.message.startsWith('The wheel')) throw error;
    throw new Error('Could not reach the wheel. Check your connection or try Practice.');
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
