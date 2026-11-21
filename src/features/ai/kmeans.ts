/* eslint-disable @typescript-eslint/no-non-null-assertion --
   Hot numeric loops over typed arrays; every index is in range by construction. */
/**
 * Spherical k-means on unit vectors (cosine similarity), with a seeded
 * k-means++ start so the same input always gives the same groups.
 * Pure math, no dependencies. `kmeansAsync` slices the work so big libraries
 * with large embedding models don't freeze the page.
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
  opts: { seed?: number; iterations?: number; restarts?: number } = {},
): Clustering {
  const steps = kmeansSteps(vectors, k, opts);
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}

/** Roughly how many multiply-adds to do between pauses (~10–20 ms). */
const WORK_PER_SLICE = 2e7;

/**
 * Same as `kmeans`, but gives the page a chance to paint and handle input
 * between slices of work (a 5,000 × 2,560-dim library is seconds of maths),
 * and stops when `signal` is aborted.
 */
export async function kmeansAsync(
  vectors: Float32Array[],
  k: number,
  opts: {
    seed?: number;
    iterations?: number;
    restarts?: number;
    signal?: AbortSignal;
  } = {},
): Promise<Clustering> {
  const steps = kmeansSteps(vectors, k, opts);
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
    await new Promise((r) => setTimeout(r, 0));
    if (opts.signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  }
}

/** Multiply-adds per assignment pass below which extra restarts are cheap. */
const RESTART_BUDGET = 1e8;

/**
 * Best of several seeded runs (lowest total distance to the centres). One
 * k-means++ start can put two centres in one topic and merge two others,
 * which is common with a few links per topic; a handful of restarts fixes
 * that. Big inputs get fewer restarts so organizing stays quick.
 */
function* kmeansSteps(
  vectors: Float32Array[],
  k: number,
  {
    seed = 42,
    iterations = 30,
    restarts,
  }: { seed?: number; iterations?: number; restarts?: number } = {},
): Generator<void, Clustering> {
  const n = vectors.length;
  const kk = Math.max(1, Math.min(k, n));
  const dims = vectors[0]?.length ?? 0;
  const runs =
    restarts ??
    Math.max(1, Math.min(10, Math.floor(RESTART_BUDGET / Math.max(1, n * kk * dims))));
  let best: Clustering | null = null;
  let bestCost = Infinity;
  for (let r = 0; r < runs; r++) {
    const run: Clustering = yield* singleRun(vectors, k, {
      seed: seed + r * 7919,
      iterations,
    });
    let cost = 0;
    for (let i = 0; i < n; i++)
      cost += 1 - dot(vectors[i]!, run.centroids[run.assignment[i]!]!);
    if (cost < bestCost - 1e-9) {
      bestCost = cost;
      best = run;
    }
  }
  return best ?? { assignment: new Int32Array(n), centroids: [] };
}

function* singleRun(
  vectors: Float32Array[],
  k: number,
  { seed, iterations }: { seed: number; iterations: number },
): Generator<void, Clustering> {
  const n = vectors.length;
  const kk = Math.max(1, Math.min(k, n));
  const random = rng(seed);
  const first = vectors[Math.floor(random() * n)];
  const centroids: Float32Array[] = first ? [Float32Array.from(first)] : [];
  // Greedy k-means++: weight points by distance to the nearest centre so far
  // (1 − cos is half the squared Euclidean distance on unit vectors), draw a
  // few candidates and keep the one that lowers the total distance most.
  const best = new Float64Array(n).fill(Infinity);
  const dims = vectors[0]?.length ?? 0;
  const trials = 2 + Math.floor(Math.log(kk));
  // Rows per slice in the assignment loop.
  const rowsPerSlice = Math.max(1, Math.floor(WORK_PER_SLICE / Math.max(1, kk * dims)));
  const seedsPerSlice = Math.max(
    1,
    Math.floor(WORK_PER_SLICE / Math.max(1, n * dims * (trials + 1))),
  );
  while (centroids.length < kk) {
    if (centroids.length % seedsPerSlice === 0) yield;
    const last = centroids[centroids.length - 1]!;
    let total = 0;
    for (let i = 0; i < n; i++) {
      const d = 1 - dot(vectors[i]!, last);
      if (d < best[i]!) best[i] = d;
      total += Math.max(0, best[i]!);
    }
    let chosen = n - 1;
    let chosenCost = Infinity;
    for (let t = 0; t < trials; t++) {
      let pick = random() * total;
      let candidate = n - 1;
      for (let i = 0; i < n; i++) {
        pick -= Math.max(0, best[i]!);
        if (pick <= 0) {
          candidate = i;
          break;
        }
      }
      const cv = vectors[candidate]!;
      let cost = 0;
      for (let i = 0; i < n; i++)
        cost += Math.max(0, Math.min(best[i]!, 1 - dot(vectors[i]!, cv)));
      if (cost < chosenCost) {
        chosenCost = cost;
        chosen = candidate;
      }
    }
    centroids.push(Float32Array.from(vectors[chosen]!));
  }

  const assignment = new Int32Array(n).fill(-1);
  for (let iter = 0; iter < iterations; iter++) {
    let changed = 0;
    for (let i = 0; i < n; i++) {
      if (i % rowsPerSlice === 0) yield;
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

/**
 * Folder counts worth trying for `n` links: from a handful up to about one
 * folder per 8 links, capped at 60.
 */
export function candidateKs(n: number): number[] {
  const max = Math.max(4, Math.min(60, Math.floor(n / 8)));
  const steps = [4, 6, 8, 10, 12, 15, 18, 22, 26, 30, 36, 42, 50, 60];
  const ks = steps.filter((k) => k <= max && k < n);
  return ks.length ? ks : [Math.max(2, Math.min(n, 4))];
}

/** Mean silhouette (cosine distance) of a clustering: higher = cleaner groups. */
export function silhouette(
  vectors: readonly Float32Array[],
  assignment: Int32Array,
): number {
  const n = vectors.length;
  if (n < 3) return 0;
  const clusters = new Map<number, number[]>();
  assignment.forEach((c, i) => clusters.set(c, [...(clusters.get(c) ?? []), i]));
  if (clusters.size < 2) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const vi = vectors[i];
    const own = assignment[i] ?? 0;
    if (!vi) continue;
    let a = 0;
    let b = Infinity;
    for (const [c, members] of clusters) {
      let sum = 0;
      let count = 0;
      for (const j of members) {
        const vj = vectors[j];
        if (j === i || !vj) continue;
        sum += 1 - dot(vi, vj);
        count++;
      }
      if (!count) continue;
      const mean = sum / count;
      if (c === own) a = mean;
      else b = Math.min(b, mean);
    }
    if ((clusters.get(own)?.length ?? 0) <= 1 || b === Infinity) continue;
    total += (b - a) / Math.max(a, b);
  }
  return total / n;
}

/**
 * Lets the data decide how many folders: clusters a sample at each candidate
 * count and keeps the one whose groups separate most cleanly (silhouette),
 * preferring more folders when scores are nearly equal.
 */
export async function chooseKFromData(
  vectors: readonly Float32Array[],
  { sample = 240, seed = 7 }: { sample?: number; seed?: number } = {},
): Promise<{ k: number; scores: Array<[number, number]> }> {
  const n = vectors.length;
  const ks = candidateKs(n);
  // A fixed random sample keeps this fast on big libraries (and repeatable).
  const random = rng(seed);
  const idx = [...vectors.keys()];
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [idx[i], idx[j]] = [idx[j] ?? 0, idx[i] ?? 0];
  }
  const picked = idx
    .slice(0, Math.min(sample, n))
    .flatMap((i) => (vectors[i] ? [vectors[i]] : []));
  const scores: Array<[number, number]> = [];
  for (const k of ks.filter((k) => k < picked.length)) {
    scores.push([
      k,
      silhouette(
        picked,
        kmeans(picked, k, { seed, iterations: 20, restarts: 3 }).assignment,
      ),
    ]);
    // Let the page breathe between tries (this runs on the main thread).
    await new Promise((r) => setTimeout(r, 0));
  }
  if (!scores.length) return { k: chooseK(n), scores };
  const best = Math.max(...scores.map(([, s]) => s));
  const k = Math.max(...scores.filter(([, s]) => s >= best - 0.01).map(([k]) => k));
  return { k, scores };
}
