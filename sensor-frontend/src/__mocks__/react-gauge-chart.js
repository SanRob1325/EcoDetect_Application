import React from 'react';

// Mock implementation of GaugeChart
const GaugeChart = (props) => (
  <div data-testid="mock-gauge-chart">
    Mock Gauge Chart (Value: {props.percent || 'None'})
  </div>
);

export default GaugeChart;