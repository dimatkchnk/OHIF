import { DicomMetadataStore } from '@ohif/core/src/services/DicomMetadataStore';

export function computeTtpWr({ images, pixelPoints, startFrame = 8 }) {
  // const images = imageIds.map(id => cache.getImage(id));
  console.log(images[0].getPixelData());
  const rows = images[0].rows;
  const cols = images[0].columns;

  const inRoi = createPolygonMask(pixelPoints, cols, rows);

  console.log('ROI mask created:', inRoi.reduce((sum, v) => sum + v, 0), 'pixels inside ROI');

  // Sort images in place by AcquisitionDateTime
  images.sort((a, b) => {
    const idA = a.referencedImageId ?? a.imageId;
    const idB = b.referencedImageId ?? b.imageId;

    const instA = DicomMetadataStore.getInstanceByImageId(idA);
    const instB = DicomMetadataStore.getInstanceByImageId(idB);

    const dtA = instA?.AcquisitionDateTime;
    const dtB = instB?.AcquisitionDateTime;

    // Handle missing timestamps: put them at the end (or filter later)
    if (!dtA && !dtB) return 0;
    if (!dtA) return 1;
    if (!dtB) return -1;

    const parse = (s) => {
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

  const frames = images.map(img => img.getPixelData());
  const instances = images.map(img => DicomMetadataStore.getInstanceByImageId(img.referencedImageId ?? img.imageId));

  // --- Time axis ---
  const timeSeconds = [];

  let baseTimeMs = null;

  for (const instance of instances) {
    const dtStr = instance.AcquisitionDateTime;
    if (!dtStr) continue;

    // Ignore fractional seconds (same as Python split('.'))
    const core = dtStr.split('.')[0];

    const year   = parseInt(core.slice(0, 4), 10);
    const month  = parseInt(core.slice(4, 6), 10) - 1; // JS months are 0-based
    const day    = parseInt(core.slice(6, 8), 10);
    const hour   = parseInt(core.slice(8, 10), 10);
    const minute = parseInt(core.slice(10, 12), 10);
    const second = parseInt(core.slice(12, 14), 10);

    const dtMs = Date.UTC(year, month, day, hour, minute, second);

    if (baseTimeMs === null) {
      baseTimeMs = dtMs;
    }

    const deltaSec = (dtMs - baseTimeMs) / 1000;
    timeSeconds.push(deltaSec);
  }
  // console.log(frames[0]);
  // console.log(Math.max(frames[0]));
  console.log(timeSeconds);

  // --- Handle freehand ROI ---
  // const pts = annotationObj.pointsCanvas;
  // if (!pts || pts.length < 3) {
  //   console.warn('ROI requires at least 3 points');
  //   return { meanCurve: [], colorMap: new Uint8ClampedArray(rows * cols * 4) };
  // }

  // Ensure closed (optional, but safe)
  // let polygonPoints = pts;
  // if (pts[0][0] !== pts[pts.length - 1][0] || pts[0][1] !== pts[pts.length - 1][1]) {
  //   polygonPoints = [...pts, pts[0]];
  // }

  // Generate mask using canvas
  // const inRoi = createPolygonMask(polygonPoints, cols, rows); // width=cols, height=rows

  // const polygonCanvas = annotationObj.pointsCanvas
  // const invalidPoint = pixelPoints.find(([i,j]) => i < 0 || i >= cols || j < 0 || j >= rows);
  // if (invalidPoint) {
  //   console.error('ROI point outside image bounds:', invalidPoint, {cols, rows});
  //   throw new Error('ROI extends beyond image boundaries');
  // }

  // const inRoi = buildRoiMaskFromPixelCoords({ polygonPixel: pixelPoints, rows, cols });

  // console.log('ROI pixels:', inRoi.filter(v => v).length);

  // --- Compute TTP/WR only inside ROI ---
  const labelmap = new Uint8Array(rows * cols); // segment index per pixel
  const allCurves = [];

  for (let i = 0; i < rows * cols; i++) {
    if (!inRoi[i]) continue;

    const intensities = frames.map(f => f[i]);
    const min = Math.min(...intensities);
    const max = Math.max(...intensities);
    if (min === max) continue;

    allCurves.push(intensities);

    const pre = mean(intensities.slice(1, startFrame));
    const cut = intensities.slice(startFrame);
    const peakIdx = argMax(cut);
    const peak = cut[peakIdx];
    const end = intensities[intensities.length - 1];

    const TTP = timeSeconds[startFrame + peakIdx] - timeSeconds[startFrame];
    let WR = 0;
    if (peak > pre) WR = ((peak - end) / (peak - pre)) * 100;

    labelmap[i] = classify(TTP, WR);
  }

  const meanCurve = timeSeconds.map((t, i) => ({
    time: t,
    intensity: allCurves.reduce((s, c) => s + c[i], 0) / (allCurves.length || 1),
  }));

  return { meanCurve, labelmap, cols, rows };
}

// ------------------

export function classify(TTP: number, WR: number): number {
  if (TTP < 0) return 0;
  if (TTP > 120 && WR < 10 ) return 1; // A
  if (TTP <= 120 && WR >= 30) return 2; // B
  if (TTP <= 120 && WR < 30) return 3; // C
  return 0; // background / unclassified
}

// Optional: map segment index → [r,g,b,a]
export const segmentColorMap: Record<number, [number, number, number, number]> = {
  0: [0, 0, 0, 0],       // transparent
  1: [255, 0, 0, 180],   // red
  2: [0, 255, 0, 180],   // green
  3: [0, 0, 255, 180],   // blue
};

function mean(a) {
  return a.reduce((s, v) => s + v, 0) / a.length;
}

function argMax(a) {
  return a.indexOf(Math.max(...a));
}

function createPolygonMask(points: number[][], width: number, height: number): Uint8Array {
  // Use ray-casting algorithm (no canvas dependency)
  const mask = new Uint8Array(width * height);

  // Bounding box optimization
  let minX = width, maxX = 0, minY = height, maxY = 0;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  // Ray-casting algorithm (point-in-polygon)
  for (let y = Math.max(0, minY - 1); y <= Math.min(height - 1, maxY + 1); y++) {
    for (let x = Math.max(0, minX - 1); x <= Math.min(width - 1, maxX + 1); x++) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];

        // Check if ray crosses edge
        const intersect = ((yi > y) !== (yj > y)) &&
          (x < (xj - xi) * (y - yi) / (yj - yi + Number.EPSILON) + xi);
        if (intersect) inside = !inside;
      }
      if (inside) {
        mask[y * width + x] = 1;
      }
    }
  }

  return mask;
}

// function dicomDateTimeToMs(dt) {
//   if (!dt) return null;
//
//   const year   = dt.slice(0, 4);
//   const month  = dt.slice(4, 6);
//   const day    = dt.slice(6, 8);
//   const hour   = dt.slice(8, 10);
//   const minute = dt.slice(10, 12);
//   const second = dt.slice(12, 14);
//   const frac   = dt.split('.')[1] ?? '0';
//
//   const ms = frac.padEnd(6, '0').slice(0, 3); // microseconds → ms
//
//   const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}.${ms}Z`;
//   return Date.parse(iso);
// }

// function buildRoiMask({
//                         polygonCanvas, // [{x,y}] or [[x,y]]
//                         rows,
//                         cols
//                       }) {
//   // Create offscreen canvas
//   const canvas = document.createElement('canvas');
//   canvas.width = cols;
//   canvas.height = rows;
//
//   const ctx = canvas.getContext('2d');
//
//   // Build path
//   const path = new Path2D();
//   polygonCanvas.forEach((p, i) => {
//     const x = p[0];
//     const y = p[1];
//     if (i === 0) path.moveTo(x, y);
//     else path.lineTo(x, y);
//   });
//   path.closePath();
//
//   // Fill ROI
//   ctx.fillStyle = '#fff';
//   ctx.fill(path);
//
//   // Read mask
//   const imgData = ctx.getImageData(0, 0, cols, rows).data;
//
//   // Boolean mask (true = inside ROI)
//   const inRoi = new Uint8Array(rows * cols);
//   for (let i = 0; i < rows * cols; i++) {
//     inRoi[i] = imgData[i * 4 + 3] > 0 ? 1 : 0;
//   }
//
//   return inRoi;
// }

function buildRoiMaskFromPixelCoords({
                                       polygonPixel, // Array of [i(col), j(row)] in IMAGE coordinates
                                       rows,
                                       cols
                                     }): Uint8Array {
  // 1. Create canvas matching IMAGE dimensions (not viewport!)
  const canvas = document.createElement('canvas');
  canvas.width = cols;  // Columns = width (x-axis)
  canvas.height = rows; // Rows = height (y-axis)

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.clearRect(0, 0, cols, rows);

  // 2. Draw polygon USING IMAGE PIXEL COORDINATES (i=x, j=y)
  const path = new Path2D();
  polygonPixel.forEach(([i, j], idx) => {
    if (idx === 0) path.moveTo(i, j);
    else path.lineTo(i, j);
  });
  path.closePath();

  ctx.fillStyle = '#FFF';
  ctx.fill(path);

  // 3. Generate binary mask (1=inside ROI)
  const imgData = ctx.getImageData(0, 0, cols, rows);
  const mask = new Uint8Array(rows * cols);

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const rgbaIdx = (j * cols + i) * 4;
      // Threshold to handle anti-aliasing (white = inside)
      mask[j * cols + i] = imgData.data[rgbaIdx] > 128 ? 1 : 0;
    }
  }

  return mask;
}
