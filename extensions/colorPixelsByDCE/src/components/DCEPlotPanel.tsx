import React, { useState, useEffect } from 'react'; // Add useState and useEffect
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { servicesManager } from '@ohif/app/src/App';

export default function DCEPlotPanel() {
  const dceParamsService = servicesManager.services.dceParamsService;

  // Initialize state from service
  const [startFrame, setStartFrame] = useState(dceParamsService.getStartFrame());
  const [kernelSize, setKernelSize] = useState(dceParamsService.getKernelSize());

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

  // ... existing data logic ...
  const data = [ /* your data */ ];

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
        <div>
          <label style={{ display: 'block', marginBottom: '4px', color: 'white' }}>
            Kernel Size:
            <input
              type="number"
              value={kernelSize}
              onChange={handleKernelSizeChange}
              min="1"
              style={{
                marginLeft: '8px',
                padding: '4px',
                width: '60px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                color: 'black'
              }}
            />
          </label>
        </div>
      </div>

      {/* Existing chart */}
      {!data.length ? (
        <div>Draw ROI & press DCE Analysis</div>
      ) : (
        <LineChart width={300} height={200} data={data}>
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Line dataKey="intensity" stroke="#2563eb" dot={false} />
        </LineChart>
      )}
    </div>
  );
}