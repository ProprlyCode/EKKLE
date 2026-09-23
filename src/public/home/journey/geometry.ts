// Plain geometry shared by the art and the timeline (kept out of the component
// files so React fast refresh stays happy).

/**
 * Where a point on the art (fractions fx, fy) lands inside a w×h container that
 * the art covers. Same math as .j-cover, for JS (thread endpoints, dive target).
 */
export function coverPoint(w: number, h: number, aspect: number, fx: number, fy: number) {
  const fw = Math.max(w, h * aspect);
  const fh = fw / aspect;
  return { x: (w - fw) / 2 + fx * fw, y: (h - fh) / 2 + fy * fh };
}


/** Where B's phone sits in the night panel — the camera dives into it. */
export const NIGHT_PHONE = { fx: 0.672, fy: 0.646 };
