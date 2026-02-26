import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';

export default function DCEPlotPanel({ servicesManager }) {
  // const { DCEService } = servicesManager.services;
  // const data = DCEService.getCurve();
  const data = [
    {
      time: 0,
      intensity: 10
    },
    {
      time: 1,
      intensity: 20
    },
    {
      time: 2,
      intensity: 30
    },
  ];

  if (!data.length) {
    return <div style={{ padding: 10 }}>Draw ROI & press DCE Analysis</div>;
  }

  return (
    <LineChart width={300} height={200} data={data}>
      <XAxis dataKey="time" />
      <YAxis />
      <Tooltip />
      <Line dataKey="intensity" stroke="#2563eb" dot={false} />
    </LineChart>
  );
}