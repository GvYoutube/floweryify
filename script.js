const sourceInput = document.getElementById('sourceInput');
const preserveRange = document.getElementById('preserveRange');
const preserveOutput = document.getElementById('preserveOutput');
const runButton = document.getElementById('runButton');
const referenceStatus = document.getElementById('referenceStatus');
const canvas = document.getElementById('resultCanvas');
const ctx = canvas.getContext('2d');

let sourceImage = null;
let referenceImage = null;
let worker = null;

function updateReadyState() {
  runButton.disabled = !(sourceImage && referenceImage);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load ${url}`));
    image.src = url;
  });
}

function loadSelectedFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load selected image'));
    };
    image.src = url;
  });
}

function readSquarePixels(image, size) {
  const sample = document.createElement('canvas');
  sample.width = size;
  sample.height = size;
  const sampleContext = sample.getContext('2d', { willReadFrequently: true });
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const left = (image.naturalWidth - side) / 2;
  const top = (image.naturalHeight - side) / 2;
  sampleContext.drawImage(image, left, top, side, side, 0, 0, size, size);
  return sampleContext.getImageData(0, 0, size, size).data;
}

sourceInput.addEventListener('change', async () => {
  const file = sourceInput.files && sourceInput.files[0];
  if (!file) return;
  try {
    sourceImage = await loadSelectedFile(file);
    updateReadyState();
  } catch {
    sourceImage = null;
    updateReadyState();
  }
});

preserveRange.addEventListener('input', () => {
  preserveOutput.textContent = `${preserveRange.value}%`;
});

runButton.addEventListener('click', () => {
  if (!sourceImage || !referenceImage) return;

  runButton.disabled = true;
  const size = 56;
  const sourcePixels = readSquarePixels(sourceImage, size);
  const referencePixels = readSquarePixels(referenceImage, size);

  if (worker) worker.terminate();
  worker = new Worker('worker.js');
  worker.onmessage = ({ data }) => {
    if (data.type !== 'done') return;
    canvas.width = size;
    canvas.height = size;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(data.pixels), size, size), 0, 0);
    runButton.disabled = false;
  };
  worker.onerror = () => {
    runButton.disabled = false;
  };
  worker.postMessage({
    sourcePixels,
    targetPixels: referencePixels,
    size,
    preserve: Number(preserveRange.value) / 100,
  }, [sourcePixels.buffer, referencePixels.buffer]);
});

loadImage('FloweryRef.png')
  .then((image) => {
    referenceImage = image;
    referenceStatus.textContent = 'Reference: FloweryRef.png';
    updateReadyState();
  })
  .catch(() => {
    referenceStatus.textContent = 'Reference image FloweryRef.png is missing.';
  });
