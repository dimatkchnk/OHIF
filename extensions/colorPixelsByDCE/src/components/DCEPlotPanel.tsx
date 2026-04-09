import React, { useState, useEffect } from 'react'; // Add useState and useEffect
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { servicesManager } from '@ohif/app/src/App';
import { getTypeColor } from '../utils/plotTypeColor';

// Distinct palette for ROI curves
const ROI_COLORS = [
  '#ef4444', // red
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#a855f7', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#eab308', // yellow
];

export default function DCEPlotPanel() {
  const dceParamsService = servicesManager.services.dceParamsService;

  // Initialize state from service
  const [startFrame, setStartFrame] = useState(dceParamsService.getStartFrame());
  const [kernelSize, setKernelSize] = useState(dceParamsService.getKernelSize());
  const [smoothingMethod, setSmoothingMethod] = useState<'slidingKernel' | 'mean'>(
    dceParamsService.getSmoothingMethod()
  );
  const [roiDistributions, setRoiDistributions] = useState(
    dceParamsService.getRoiDistributions()
  );
  const [roiMeanCurves, setRoiMeanCurves] = useState(
    dceParamsService.getRoiMeanCurves()
  );
  const [meanCurveTimes, setMeanCurveTimes] = useState(
    dceParamsService.getMeanCurveTimes()
  );

  useEffect(() => {
    return dceParamsService.onDistributionsChanged(() => {
      setRoiDistributions(dceParamsService.getRoiDistributions());
      setRoiMeanCurves(dceParamsService.getRoiMeanCurves());
      setMeanCurveTimes(dceParamsService.getMeanCurveTimes());
    });
  }, [dceParamsService]);

  // Build combined chart data: [{ time, "ROI 1": v, "ROI 2": v, ... }, ...]
  const meanChartData =
    smoothingMethod === 'mean' && roiMeanCurves.length > 0 && meanCurveTimes.length > 0
      ? meanCurveTimes.map((t, i) => {
          const row: Record<string, number> = { time: Math.round(t) };
          for (const c of roiMeanCurves) {
            row[`ROI ${c.roi}`] = c.intensities[i];
          }
          return row;
        })
      : [];

  // Sync service when inputs change
  const handleStartFrameChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value)) {
      dceParamsService.setStartFrame(value);
      setStartFrame(value);
    }
  };

  const handleKernelSizeChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0) {
      dceParamsService.setKernelSize(value);
      setKernelSize(value);
    }
  };

  const handleSmoothingMethodChange = (val) => {
    dceParamsService.setSmoothingMethod(val);
    setSmoothingMethod(val);
  };

  return (
    <div style={{ padding: '10px' }}>
      {/* NEW: Input controls */}
      <div style={{ marginBottom: '15px', display: 'grid', gap: '8px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', color: 'white' }}>
            Start Frame:
            <input
              type="number"
              value={startFrame}
              onChange={handleStartFrameChange}
              min="1"
              style={{
                marginLeft: '8px',
                padding: '4px',
                width: '60px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                color: 'black',
              }}
            />
          </label>
        </div>
        <div style={{ display: 'flex', gap: '16px', color: 'white' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={smoothingMethod === 'slidingKernel'}
              onChange={() => handleSmoothingMethodChange('slidingKernel')}
            />
            Sliding Kernel
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={smoothingMethod === 'mean'}
              onChange={() => handleSmoothingMethodChange('mean')}
            />
            Mean
          </label>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', color: 'white' }}>
            Kernel Size:
            <input
              type="number"
              value={kernelSize}
              onChange={handleKernelSizeChange}
              min="1"
              disabled={smoothingMethod === 'mean'}
              style={{
                marginLeft: '8px',
                padding: '4px',
                width: '60px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                color: 'black',
                opacity: smoothingMethod === 'mean' ? 0.5 : 1,
              }}
            />
          </label>
        </div>
      </div>

      {/* Mean curves per ROI (only when smoothing method is 'mean') */}
      {smoothingMethod === 'mean' && (
        <div style={{ color: 'white' }}>
          {meanChartData.length === 0 ? (
            <div>Draw ROI & press DCE Analysis</div>
          ) : (
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                Mean intensity over time
              </div>
              <ResponsiveContainer width="100%" aspect={1.5}>
                <LineChart
                  data={meanChartData}
                  margin={{ top: 5, right: 10, bottom: 20, left: 0 }}
                >
                  <CartesianGrid stroke="#444" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    stroke="#ccc"
                    label={{ value: 's', position: 'insideBottom', offset: -5, fill: '#ccc' }}
                  />
                  <YAxis stroke="#ccc" width={50} />
                  <Tooltip
                    contentStyle={{ background: '#222', border: '1px solid #555' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Legend wrapperStyle={{ color: '#fff' }} />
                  {roiMeanCurves.map((c, i) => (
                    <Line
                      key={c.roi}
                      type="monotone"
                      dataKey={`ROI ${c.roi}`}
                      stroke={ROI_COLORS[i % ROI_COLORS.length]}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Pixel type distribution per ROI */}
      {smoothingMethod === 'slidingKernel' && roiDistributions.length > 0 && (
        <div style={{ marginTop: '15px', color: 'white' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Pixel Distribution</div>
          {roiDistributions.map((roi) => (
            <div key={roi.roi} style={{ marginBottom: '10px' }}>
              <div style={{ marginBottom: '4px' }}>ROI {roi.roi} ({roi.total} pixels)</div>
              {Object.entries(roi.percentages).map(([name, pct]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 8px' }}>
                  <span style={{ color: getTypeColor(name) || 'white' }}>{name}</span>
                  <span>{pct}%</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}