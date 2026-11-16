self.onmessage = ({ data }) => {
  const { sourcePixels, targetPixels, size, preserve } = data;
  const source = new Uint8ClampedArray(sourcePixels);
  const target = new Uint8ClampedArray(targetPixels);
  const count = size * size;
  const assignment = new Uint32Array(count);
  const costs = new Float32Array(count);
  const positionX = new Int16Array(count);
  const positionY = new Int16Array(count);
  const movementWeight = 0.0007 + preserve * 0.03;

  for (let i = 0; i < count; i++) {
    assignment[i] = i;
    positionX[i] = i % size;
    positionY[i] = Math.floor(i / size);
  }

  function cost(destination, sourceIndex) {
    const s = sourceIndex * 4;
    const t = destination * 4;
    const dr = source[s] - target[t];
    const dg = source[s + 1] - target[t + 1];
    const db = source[s + 2] - target[t + 2];
    const dx = positionX[sourceIndex] - positionX[destination];
    const dy = positionY[sourceIndex] - positionY[destination];
    return 0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db + movementWeight * (dx * dx + dy * dy);
  }

  for (let i = 0; i < count; i++) costs[i] = cost(i, i);

  let seed = 0x9e3779b9;
  function random(max) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) % max;
  }

  const rounds = 8;
  const attempts = count * 36;
  for (let round = 0; round < rounds; round++) {
    const radius = Math.max(2, Math.floor(size * (0.5 - round / 18)));
    for (let attempt = 0; attempt < attempts; attempt++) {
      const a = random(count);
      const ax = a % size;
      const ay = Math.floor(a / size);
      const bx = Math.max(0, Math.min(size - 1, ax + random(radius * 2 + 1) - radius));
      const by = Math.max(0, Math.min(size - 1, ay + random(radius * 2 + 1) - radius));
      const b = by * size + bx;
      if (a === b) continue;

      const sourceA = assignment[a];
      const sourceB = assignment[b];
      const costA = cost(a, sourceB);
      const costB = cost(b, sourceA);
      if (costA + costB < costs[a] + costs[b]) {
        assignment[a] = sourceB;
        assignment[b] = sourceA;
        costs[a] = costA;
        costs[b] = costB;
      }
    }
  }

  const output = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i++) {
    const from = assignment[i] * 4;
    const to = i * 4;
    output[to] = source[from];
    output[to + 1] = source[from + 1];
    output[to + 2] = source[from + 2];
    output[to + 3] = 255;
  }

  self.postMessage({ type: 'done', pixels: output.buffer }, [output.buffer]);
};
