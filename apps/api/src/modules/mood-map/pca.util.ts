/**
 * Projects an array of n-dimensional vectors down to 2D using PCA.
 * Uses power iteration (deflation method) — no external deps required.
 */
export function projectTo2d(vectors: number[][]): [number, number][] {
  if (vectors.length === 0) return [];

  const n = vectors.length;
  const d = vectors[0].length;

  // 1. Compute mean per dimension
  const mean = new Array(d).fill(0) as number[];
  for (const v of vectors) {
    for (let j = 0; j < d; j++) mean[j] += v[j] / n;
  }

  // 2. Center the data
  const centered = vectors.map((v) => v.map((x, j) => x - mean[j]));

  // 3. Covariance matrix (d×d)
  const cov: number[][] = Array.from({ length: d }, () => new Array(d).fill(0) as number[]);
  for (const v of centered) {
    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++) {
        cov[i][j] += (v[i] * v[j]) / n;
      }
    }
  }

  // 4. Power iteration: find the dominant eigenvector of a matrix
  const dominantEigenvector = (matrix: number[][]): number[] => {
    let v = new Array(d).fill(0) as number[];
    v[0] = 1;
    for (let iter = 0; iter < 200; iter++) {
      const w = matrix.map((row) => row.reduce((sum, x, j) => sum + x * v[j], 0));
      const norm = Math.sqrt(w.reduce((sum, x) => sum + x * x, 0));
      if (norm < 1e-12) break;
      v = w.map((x) => x / norm);
    }
    return v;
  };

  const e1 = dominantEigenvector(cov);

  // 5. Deflate: subtract the first principal component from the covariance matrix
  const lambda1 = e1.reduce(
    (sum, x, i) => sum + x * cov[i].reduce((s, y, j) => s + y * e1[j], 0),
    0,
  );
  const deflated = cov.map((row, i) => row.map((x, j) => x - lambda1 * e1[i] * e1[j]));

  const e2 = dominantEigenvector(deflated);

  // 6. Project each vector onto the two principal components
  return centered.map((v) => [
    v.reduce((sum, x, j) => sum + x * e1[j], 0),
    v.reduce((sum, x, j) => sum + x * e2[j], 0),
  ]);
}

/** Normalize a set of [x, y] pairs so all values fall in [0, 1]. */
export function normalizePoints(points: [number, number][]): [number, number][] {
  if (points.length === 0) return [];

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  return points.map(([x, y]) => [(x - minX) / rangeX, (y - minY) / rangeY]);
}
