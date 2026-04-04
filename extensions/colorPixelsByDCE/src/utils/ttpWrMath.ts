import { DicomMetadataStore } from '@ohif/core/src/services/DicomMetadataStore';

function saveGrayscaleUint8(data, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);

  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    const j = i * 4;

    imageData.data[j] = v; // R
    imageData.data[j + 1] = v; // G
    imageData.data[j + 2] = v; // B
    imageData.data[j + 3] = 255; // A
  }

  ctx.putImageData(imageData, 0, 0);

  // Save
  const link = document.createElement('a');
  link.download = 'grayscale.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// Ray-casting point-in-polygon test
function isInsidePolygon(x: number, y: number, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function computeTtpWr({ images, startFrame = 8, kernelSize = 1, smoothingMethod = 'slidingKernel', roiPolygons = null }) {
  const rows = images[0].rows;
  const cols = images[0].columns;
  // Sort images by AcquisitionDateTime
  images.sort((a, b) => {
    const idA = a.referencedImageId ?? a.imageId;
    const idB = b.referencedImageId ?? b.imageId;

    const instA = DicomMetadataStore.getInstanceByImageId(idA);
    const instB = DicomMetadataStore.getInstanceByImageId(idB);
    const dtA = instA?.AcquisitionDateTime;
    const dtB = instB?.AcquisitionDateTime;

    if (!dtA && !dtB) return 0;
    if (!dtA) return 1;
    if (!dtB) return -1;

    const parse = s => {
      const core = s.split('.')[0];
      const y = parseInt(core.slice(0, 4), 10);
      const m = parseInt(core.slice(4, 6), 10) - 1;
      const d = parseInt(core.slice(6, 8), 10);
      const H = parseInt(core.slice(8, 10), 10);
      const M = parseInt(core.slice(10, 12), 10);
      const S = parseInt(core.slice(12, 14), 10);
      return Date.UTC(y, m, d, H, M, S);
    };

    return parse(dtA) - parse(dtB);
  });

  // Extract pixel data and timestamps
  const frames = images.map(img => img.getPixelData()); // Each frame: Float32Array or Uint16Array
  const instances = images.map(img =>
    DicomMetadataStore.getInstanceByImageId(img.referencedImageId ?? img.imageId)
  );

  // saveGrayscaleUint8(frames[40], rows, cols);

  const timeSeconds = [];
  let baseTimeMs = null;

  for (const instance of instances) {
    const dtStr = instance.AcquisitionDateTime;
    if (!dtStr) continue;

    const core = dtStr.split('.')[0];
    const year = parseInt(core.slice(0, 4), 10);
    const month = parseInt(core.slice(4, 6), 10) - 1;
    const day = parseInt(core.slice(6, 8), 10);
    const hour = parseInt(core.slice(8, 10), 10);
    const minute = parseInt(core.slice(10, 12), 10);
    const second = parseInt(core.slice(12, 14), 10);

    const dtMs = Date.UTC(year, month, day, hour, minute, second);

    if (baseTimeMs === null) baseTimeMs = dtMs;

    const deltaSec = (dtMs - baseTimeMs) / 1000;
    timeSeconds.push(deltaSec);
  }

  console.log('Time seconds:', timeSeconds);

  // --- Prepare output ---
  const labelmap = new Uint8Array(rows * cols); // Final segmentation map
  const allCurves = []; // To compute average curve

  // Helper functions
  function mean(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  function argMax(array) {
    return array.reduce((maxIdx, val, idx, arr) => (val > arr[maxIdx] ? idx : maxIdx), 0);
  }

  function classify(TTP, WR) {
    if (TTP <= 0) return 0;
    else if (TTP > 120 && WR < 10)
      return 1; // Blue - A
    else if (TTP <= 120 && WR >= 30)
      return 2; // Yellow - B
    else if (TTP <= 120 && WR < 30)
      return 3; // Red - C
    else return 4;
  }

  // Pre-compute ROI mask as union of all polygons
  let roiMask: Uint8Array | null = null;
  if (roiPolygons && roiPolygons.length > 0) {
    roiMask = new Uint8Array(rows * cols);
    for (let py = 0; py < rows; py++) {
      for (let px = 0; px < cols; px++) {
        for (const polygon of roiPolygons) {
          if (isInsidePolygon(px, py, polygon)) {
            roiMask[py * cols + px] = 1;
            break;
          }
        }
      }
    }
  }

  if (smoothingMethod === 'mean') {
    // --- Mean: compute mean curve per ROI polygon, classify and color each separately ---
    const polygons = roiPolygons ?? [];

    for (const polygon of polygons) {
      // Collect pixel indices for this polygon
      const polyIndices: number[] = [];
      for (let py = 0; py < rows; py++) {
        for (let px = 0; px < cols; px++) {
          if (isInsidePolygon(px, py, polygon)) {
            polyIndices.push(py * cols + px);
          }
        }
      }
      if (polyIndices.length === 0) continue;

      // Mean intensity over time for this polygon
      const meanIntensitiesOverTime: number[] = [];
      for (let t = 0; t < frames.length; t++) {
        const frame = frames[t];
        let sum = 0;
        for (const idx of polyIndices) {
          sum += frame[idx];
        }
        meanIntensitiesOverTime.push(sum / polyIndices.length);
      }

      allCurves.push(meanIntensitiesOverTime);

      const preVal = mean(meanIntensitiesOverTime.slice(1, startFrame));
      const cutIntensities = meanIntensitiesOverTime.slice(startFrame);
      const peakIdx = argMax(cutIntensities);
      const peakVal = cutIntensities[peakIdx];
      const endVal = meanIntensitiesOverTime[meanIntensitiesOverTime.length - 1];

      const TTP = timeSeconds[startFrame + peakIdx] - timeSeconds[startFrame];
      let WR = 0;
      if (peakVal > preVal && peakVal !== preVal) {
        WR = ((peakVal - endVal) / (peakVal - preVal)) * 100;
      }

      const segmentLabel = classify(TTP, WR);

      for (const idx of polyIndices) {
        labelmap[idx] = segmentLabel;
      }
    }
  } else {
    // --- Sliding Kernel Processing ---
    const step = 1;

    for (let y = 0; y < rows - kernelSize + 1; y += step) {
      for (let x = 0; x < cols - kernelSize + 1; x += step) {
        if (roiMask && !roiMask[y * cols + x]) continue;

        const kernelIntensitiesOverTime: number[] = [];

        for (let t = 0; t < frames.length; t++) {
          const frame = frames[t];
          let sum = 0;
          let count = 0;

          for (let dy = 0; dy < kernelSize; dy++) {
            for (let dx = 0; dx < kernelSize; dx++) {
              const py = y + dy;
              const px = x + dx;
              sum += frame[py * cols + px];
              count++;
            }
          }

          kernelIntensitiesOverTime.push(sum / count);
        }

        const min = Math.min(...kernelIntensitiesOverTime);
        const max = Math.max(...kernelIntensitiesOverTime);
        if (min === max || max - min < 20) continue;

        allCurves.push(kernelIntensitiesOverTime);

        const preVal = mean(kernelIntensitiesOverTime.slice(1, startFrame));
        const cutIntensities = kernelIntensitiesOverTime.slice(startFrame);
        const peakIdx = argMax(cutIntensities);
        const peakVal = cutIntensities[peakIdx];
        const endVal = kernelIntensitiesOverTime[kernelIntensitiesOverTime.length - 1];

        const TTP = timeSeconds[startFrame + peakIdx] - timeSeconds[startFrame];
        let WR = 0;
        if (peakVal > preVal && peakVal !== preVal) {
          WR = ((peakVal - endVal) / (peakVal - preVal)) * 100;
        }

        const segmentLabel = classify(TTP, WR);

        for (let dy = 0; dy < kernelSize; dy++) {
          for (let dx = 0; dx < kernelSize; dx++) {
            const py = y + dy;
            const px = x + dx;
            const idx1D = py * cols + px;
            if (!roiMask || roiMask[idx1D]) {
              labelmap[idx1D] = segmentLabel;
            }
          }
        }
      }
    }
  }

  // --- Compute Mean Curve Across All Kernels ---
  let meanCurve = [];

  // if (allCurves.length > 0) {
  //   meanCurve = timeSeconds.map((t, i) =>
  //     allCurves.reduce((sum, curve) => sum + curve[i], 0) / allCurves.length
  //   ).map(intensity => ({ time: t, intensity }));
  // } else {
  //   // Fallback: empty plot
  //   meanCurve = timeSeconds.map(t => ({ time, intensity: 0 }));
  // }

  return { meanCurve, labelmap, cols, rows };
}
