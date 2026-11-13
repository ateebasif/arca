/* eslint-disable @typescript-eslint/no-non-null-assertion --
   Hot numeric loops over typed arrays; every index is in range by construction. */
/**
 * Spherical k-means on unit vectors (cosine similarity), with a seeded
 * k-means++ start so the same input always gives the same groups.
 * Pure math, no dependencies: ~4,000 × 768 dims runs in well under a second.
 */

export function normalize(v: ArrayLike<number>): Float32Array {
  let norm = 0;
  for (let i = 0; i < v.length; i++) norm += (v[i] ?? 0) ** 2;
  const out = new Float32Array(v.length);
  const scale = norm > 0 ? 1 / Math.sqrt(norm) : 0;
  for (let i = 0; i < v.length; i++) out[i] = (v[i] ?? 0) * scale;
  return out;
}

export function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] ?? 0) * (b[i] ?? 0);
  return s;
}

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** A sensible number of groups for n items: about √(n/3), between 4 and 24. */
export function chooseK(n: number): number {
  return Math.max(2, Math.min(24, Math.max(4, Math.round(Math.sqrt(n / 3))), n));
}

export interface Clustering {
  /** Cluster index per vector. */
  assignment: Int32Array;
  centroids: Float32Array[];
}

export function kmeans(
  vectors: Float32Array[],
  k: number,
  { seed = 42, iterations = 30 } = {},
): Clustering {
  const n = vectors.length;
  const kk = Math.max(1, Math.min(k, n));
  const random = rng(seed);
  const first = vectors[Math.floor(random() * n)];
  const centroids: Float32Array[] = first ? [Float32Array.from(first)] : [];
  // k-means++: pick each next centre far from existing ones.
  const best = new Float64Array(n).fill(Infinity);
  while (centroids.length < kk) {
    const last = centroids[centroids.length - 1]!;
    let total = 0;
    for (let i = 0; i < n; i++) {
      const d = 1 - dot(vectors[i]!, last);
      if (d < best[i]!) best[i] = d;
      total += Math.max(0, best[i]!);
    }
    let pick = random() * total;
    let chosen = n - 1;
    for (let i = 0; i < n; i++) {
      pick -= Math.max(0, best[i]!);
      if (pick <= 0) {
        chosen = i;
        break;
      }
    }
    centroids.push(Float32Array.from(vectors[chosen]!));
  }

  const assignment = new Int32Array(n).fill(-1);
  const dims = vectors[0]?.length ?? 0;
  for (let iter = 0; iter < iterations; iter++) {
    let changed = 0;
    for (let i = 0; i < n; i++) {
      let bestC = 0;
      let bestSim = -Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const sim = dot(vectors[i]!, centroids[c]!);
        if (sim > bestSim) {
          bestSim = sim;
          bestC = c;
        }
      }
      if (assignment[i] !== bestC) {
        assignment[i] = bestC;
        changed++;
      }
    }
    // Recompute centroids as normalized means.
    const sums = centroids.map(() => new Float32Array(dims));
    for (let i = 0; i < n; i++) {
      const sum = sums[assignment[i]!]!;
      const v = vectors[i]!;
      for (let d = 0; d < dims; d++) sum[d]! += v[d]!;
    }
    for (let c = 0; c < centroids.length; c++) {
      if (sums[c]!.some((x) => x !== 0)) centroids[c] = normalize(sums[c]!);
    }
    if (changed === 0) break;
  }
  return { assignment, centroids };
}

/**
 * Members per cluster, with clusters smaller than `minSize` folded into the
 * most similar bigger cluster. Members are ordered closest-to-centre first.
 */
export function groupMembers(
  vectors: Float32Array[],
  { assignment, centroids }: Clustering,
  minSize = 3,
): number[][] {
  const groups = centroids.map(() => [] as number[]);
  assignment.forEach((c, i) => groups[c]!.push(i));
  const big = groups.map((g, c) => (g.length >= minSize ? c : -1)).filter((c) => c >= 0);
  if (big.length > 0) {
    groups.forEach((g, c) => {
      if (g.length >= minSize) return;
      for (const i of g) {
        let target = big[0]!;
        let bestSim = -Infinity;
        for (const b of big) {
          const sim = dot(vectors[i]!, centroids[b]!);
          if (sim > bestSim) {
            bestSim = sim;
            target = b;
          }
        }
        groups[target]!.push(i);
      }
      groups[c] = [];
    });
  }
  return groups
    .map((g, c) =>
      g
        .map((i) => ({ i, s: dot(vectors[i]!, centroids[c]!) }))
        .sort((a, b) => b.s - a.s)
        .map((x) => x.i),
    )
    .filter((g) => g.length > 0)
    .sort((a, b) => b.length - a.length);
}
