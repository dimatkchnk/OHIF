type PlotType = 'A' | 'B' | 'C' | 'E' | string;

type ColorFormat = 'hex' | 'rgba';

const colorMap: Record<PlotType, { hex: string; rgba: [number, number, number, number] }> = {
  A: { hex: '#4cbf00', rgba: [76, 191, 0, 255] }, // green
  B: { hex: '#fab619', rgba: [250, 182, 25, 255] }, // orange
  C: { hex: '#cf1f00', rgba: [194, 29, 0, 255] }, // red
  E: { hex: '#cbe605', rgba: [203, 230, 5, 255] }, // light green
};

export function getTypeColor(type: PlotType, format: ColorFormat = 'hex') {
  const color = colorMap[type];
  return color[format];
}
