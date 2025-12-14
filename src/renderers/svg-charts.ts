/**
 * SVG Chart Generator
 *
 * Generates SVG charts and converts them to terminal-displayable images
 * using D3.js for generation, resvg-js for fast SVG→PNG conversion,
 * and terminal-image for display.
 */

import D3Node from 'd3-node';
import { Resvg } from '@resvg/resvg-js';
import terminalImage from 'terminal-image';

// ============================================================================
// Types
// ============================================================================

export interface ChartOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
  lineColor?: string;
  fillColor?: string;
  gridColor?: string;
  textColor?: string;
  showGrid?: boolean;
  showLabels?: boolean;
  title?: string;
  padding?: { top: number; right: number; bottom: number; left: number };
}

export interface LineChartData {
  values: number[];
  labels?: string[];
}

export interface BarChartData {
  values: { label: string; value: number; color?: string }[];
}

export interface GaugeData {
  value: number;
  min?: number;
  max?: number;
  label?: string;
  colors?: { cold: string; warm: string; hot: string };
}

export interface CandlestickData {
  candles: { date: string; open: number; high: number; low: number; close: number; volume?: number }[];
}

export interface PieChartData {
  slices: { label: string; value: number; color?: string }[];
}

// Default options
const DEFAULT_OPTIONS: ChartOptions = {
  width: 400,
  height: 200,
  backgroundColor: '#1a1a2e',
  lineColor: '#00ff88',
  fillColor: 'rgba(0, 255, 136, 0.2)',
  gridColor: '#333355',
  textColor: '#aaaaaa',
  showGrid: true,
  showLabels: true,
  padding: { top: 30, right: 20, bottom: 40, left: 50 },
};

// ============================================================================
// Line Chart
// ============================================================================

export function generateLineChartSVG(data: LineChartData, options: ChartOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { width, height, padding } = opts;
  const p = padding!;

  const d3n = new D3Node();
  const d3 = d3n.d3;

  const svg = d3n.createSVG(width, height);

  // Background
  svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', opts.backgroundColor);

  const chartHeight = height! - p.top - p.bottom;

  const values = data.values;
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  // Scales
  const xScale = d3.scaleLinear()
    .domain([0, values.length - 1])
    .range([p.left, width! - p.right]);

  const yScale = d3.scaleLinear()
    .domain([minVal - range * 0.1, maxVal + range * 0.1])
    .range([height! - p.bottom, p.top]);

  // Grid
  if (opts.showGrid) {
    // Horizontal grid lines
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const y = p.top + (chartHeight / yTicks) * i;
      svg.append('line')
        .attr('x1', p.left)
        .attr('x2', width! - p.right)
        .attr('y1', y)
        .attr('y2', y)
        .attr('stroke', opts.gridColor)
        .attr('stroke-width', 0.5);
    }
  }

  // Area fill
  const area = d3.area<number>()
    .x((_d: number, i: number) => xScale(i))
    .y0(height! - p.bottom)
    .y1((d: number) => yScale(d));

  svg.append('path')
    .datum(values)
    .attr('fill', opts.fillColor)
    .attr('d', area);

  // Line
  const line = d3.line<number>()
    .x((_d: number, i: number) => xScale(i))
    .y((d: number) => yScale(d));

  svg.append('path')
    .datum(values)
    .attr('fill', 'none')
    .attr('stroke', opts.lineColor)
    .attr('stroke-width', 2)
    .attr('d', line);

  // Data points
  values.forEach((val, i) => {
    svg.append('circle')
      .attr('cx', xScale(i))
      .attr('cy', yScale(val))
      .attr('r', 3)
      .attr('fill', opts.lineColor);
  });

  // Y-axis labels
  if (opts.showLabels) {
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const val = minVal + (range / yTicks) * (yTicks - i);
      const y = p.top + (chartHeight / yTicks) * i;
      svg.append('text')
        .attr('x', p.left - 5)
        .attr('y', y + 4)
        .attr('text-anchor', 'end')
        .attr('fill', opts.textColor)
        .attr('font-size', '10px')
        .attr('font-family', 'monospace')
        .text(formatNumber(val));
    }

    // X-axis labels
    if (data.labels && data.labels.length > 0) {
      const step = Math.ceil(data.labels.length / 6);
      data.labels.forEach((label, i) => {
        if (i % step === 0 || i === data.labels!.length - 1) {
          svg.append('text')
            .attr('x', xScale(i))
            .attr('y', height! - p.bottom + 15)
            .attr('text-anchor', 'middle')
            .attr('fill', opts.textColor)
            .attr('font-size', '9px')
            .attr('font-family', 'monospace')
            .text(label);
        }
      });
    }
  }

  // Title
  if (opts.title) {
    svg.append('text')
      .attr('x', width! / 2)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .attr('fill', opts.textColor)
      .attr('font-size', '12px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold')
      .text(opts.title);
  }

  return d3n.svgString();
}

// ============================================================================
// Bar Chart
// ============================================================================

export function generateBarChartSVG(data: BarChartData, options: ChartOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { width, height, padding } = opts;
  const p = padding!;

  const d3n = new D3Node();

  const svg = d3n.createSVG(width, height);

  // Background
  svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', opts.backgroundColor);

  const chartWidth = width! - p.left - p.right;
  const chartHeight = height! - p.top - p.bottom;

  const values = data.values.map(v => v.value);
  const maxVal = Math.max(...values, 0);

  const barWidth = chartWidth / data.values.length * 0.8;
  const barGap = chartWidth / data.values.length * 0.2;

  // Bars
  data.values.forEach((item, i) => {
    const barHeight = (item.value / maxVal) * chartHeight;
    const x = p.left + i * (barWidth + barGap) + barGap / 2;
    const y = height! - p.bottom - barHeight;

    const color = item.color || (item.value >= 0 ? '#00ff88' : '#ff4444');

    svg.append('rect')
      .attr('x', x)
      .attr('y', y)
      .attr('width', barWidth)
      .attr('height', barHeight)
      .attr('fill', color)
      .attr('rx', 2);

    // Value label
    svg.append('text')
      .attr('x', x + barWidth / 2)
      .attr('y', y - 5)
      .attr('text-anchor', 'middle')
      .attr('fill', opts.textColor)
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .text(formatNumber(item.value));

    // Label
    svg.append('text')
      .attr('x', x + barWidth / 2)
      .attr('y', height! - p.bottom + 15)
      .attr('text-anchor', 'middle')
      .attr('fill', opts.textColor)
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .text(item.label);
  });

  // Title
  if (opts.title) {
    svg.append('text')
      .attr('x', width! / 2)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .attr('fill', opts.textColor)
      .attr('font-size', '12px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold')
      .text(opts.title);
  }

  return d3n.svgString();
}

// ============================================================================
// Temperature Gauge (for Weather)
// ============================================================================

export function generateTemperatureGaugeSVG(data: GaugeData, options: ChartOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, width: 120, height: 200, ...options };
  const { width, height } = opts;

  const d3n = new D3Node();
  const svg = d3n.createSVG(width, height);

  const min = data.min ?? -20;
  const max = data.max ?? 45;
  const value = Math.max(min, Math.min(max, data.value));

  // Background
  svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', opts.backgroundColor);

  const centerX = width! / 2;
  const bulbRadius = 20;
  const tubeWidth = 12;
  const tubeHeight = height! - 80;
  const tubeTop = 30;

  // Thermometer tube (outline)
  svg.append('rect')
    .attr('x', centerX - tubeWidth / 2 - 2)
    .attr('y', tubeTop - 2)
    .attr('width', tubeWidth + 4)
    .attr('height', tubeHeight + 4)
    .attr('fill', '#444466')
    .attr('rx', tubeWidth / 2);

  // Thermometer bulb (outline)
  svg.append('circle')
    .attr('cx', centerX)
    .attr('cy', tubeTop + tubeHeight + bulbRadius - 5)
    .attr('r', bulbRadius + 2)
    .attr('fill', '#444466');

  // Thermometer tube (inner)
  svg.append('rect')
    .attr('x', centerX - tubeWidth / 2)
    .attr('y', tubeTop)
    .attr('width', tubeWidth)
    .attr('height', tubeHeight)
    .attr('fill', '#222244')
    .attr('rx', tubeWidth / 2);

  // Calculate fill height
  const fillPercent = (value - min) / (max - min);
  const fillHeight = tubeHeight * fillPercent;

  // Temperature gradient color
  const getColor = (percent: number): string => {
    if (percent < 0.3) return data.colors?.cold || '#4488ff';
    if (percent < 0.6) return data.colors?.warm || '#ffaa00';
    return data.colors?.hot || '#ff4444';
  };

  const fillColor = getColor(fillPercent);

  // Mercury fill
  svg.append('rect')
    .attr('x', centerX - tubeWidth / 2 + 1)
    .attr('y', tubeTop + tubeHeight - fillHeight)
    .attr('width', tubeWidth - 2)
    .attr('height', fillHeight)
    .attr('fill', fillColor)
    .attr('rx', (tubeWidth - 2) / 2);

  // Bulb fill
  svg.append('circle')
    .attr('cx', centerX)
    .attr('cy', tubeTop + tubeHeight + bulbRadius - 5)
    .attr('r', bulbRadius)
    .attr('fill', fillColor);

  // Temperature marks
  const marks = 5;
  for (let i = 0; i <= marks; i++) {
    const y = tubeTop + tubeHeight - (tubeHeight / marks) * i;
    const tempVal = min + ((max - min) / marks) * i;

    svg.append('line')
      .attr('x1', centerX + tubeWidth / 2 + 3)
      .attr('x2', centerX + tubeWidth / 2 + 8)
      .attr('y1', y)
      .attr('y2', y)
      .attr('stroke', opts.textColor)
      .attr('stroke-width', 1);

    svg.append('text')
      .attr('x', centerX + tubeWidth / 2 + 12)
      .attr('y', y + 3)
      .attr('fill', opts.textColor)
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .text(`${Math.round(tempVal)}°`);
  }

  // Current value
  svg.append('text')
    .attr('x', centerX)
    .attr('y', height! - 10)
    .attr('text-anchor', 'middle')
    .attr('fill', fillColor)
    .attr('font-size', '16px')
    .attr('font-family', 'monospace')
    .attr('font-weight', 'bold')
    .text(`${Math.round(value)}°C`);

  // Label
  if (data.label) {
    svg.append('text')
      .attr('x', centerX)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .attr('fill', opts.textColor)
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .text(data.label);
  }

  return d3n.svgString();
}

// ============================================================================
// Weather Icon SVG
// ============================================================================

export function generateWeatherIconSVG(condition: string, options: ChartOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, width: 80, height: 80, ...options };
  const { width, height } = opts;

  const d3n = new D3Node();
  const svg = d3n.createSVG(width, height);

  const centerX = width! / 2;
  const centerY = height! / 2;

  // Background
  svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', opts.backgroundColor);

  const cond = condition.toLowerCase();

  if (cond.includes('sun') || cond.includes('clear')) {
    // Sun
    svg.append('circle')
      .attr('cx', centerX)
      .attr('cy', centerY)
      .attr('r', 15)
      .attr('fill', '#ffdd00');

    // Sun rays
    for (let i = 0; i < 8; i++) {
      const angle = (i * 45) * Math.PI / 180;
      const x1 = centerX + Math.cos(angle) * 20;
      const y1 = centerY + Math.sin(angle) * 20;
      const x2 = centerX + Math.cos(angle) * 28;
      const y2 = centerY + Math.sin(angle) * 28;

      svg.append('line')
        .attr('x1', x1)
        .attr('y1', y1)
        .attr('x2', x2)
        .attr('y2', y2)
        .attr('stroke', '#ffdd00')
        .attr('stroke-width', 3)
        .attr('stroke-linecap', 'round');
    }
  } else if (cond.includes('cloud') || cond.includes('overcast')) {
    // Cloud
    svg.append('ellipse')
      .attr('cx', centerX - 8)
      .attr('cy', centerY)
      .attr('rx', 18)
      .attr('ry', 12)
      .attr('fill', '#aabbcc');

    svg.append('ellipse')
      .attr('cx', centerX + 10)
      .attr('cy', centerY + 3)
      .attr('rx', 15)
      .attr('ry', 10)
      .attr('fill', '#99aabb');

    svg.append('ellipse')
      .attr('cx', centerX)
      .attr('cy', centerY - 8)
      .attr('rx', 12)
      .attr('ry', 10)
      .attr('fill', '#bbccdd');
  } else if (cond.includes('rain') || cond.includes('drizzle') || cond.includes('shower')) {
    // Cloud
    svg.append('ellipse')
      .attr('cx', centerX)
      .attr('cy', centerY - 8)
      .attr('rx', 20)
      .attr('ry', 12)
      .attr('fill', '#667788');

    // Rain drops
    for (let i = 0; i < 3; i++) {
      const x = centerX - 12 + i * 12;
      svg.append('line')
        .attr('x1', x)
        .attr('y1', centerY + 8)
        .attr('x2', x - 3)
        .attr('y2', centerY + 20)
        .attr('stroke', '#4488ff')
        .attr('stroke-width', 2)
        .attr('stroke-linecap', 'round');
    }
  } else if (cond.includes('snow') || cond.includes('sleet')) {
    // Cloud
    svg.append('ellipse')
      .attr('cx', centerX)
      .attr('cy', centerY - 8)
      .attr('rx', 20)
      .attr('ry', 12)
      .attr('fill', '#aabbcc');

    // Snowflakes
    for (let i = 0; i < 3; i++) {
      const x = centerX - 10 + i * 10;
      svg.append('text')
        .attr('x', x)
        .attr('y', centerY + 18)
        .attr('fill', '#ffffff')
        .attr('font-size', '12px')
        .text('*');
    }
  } else if (cond.includes('thunder') || cond.includes('storm')) {
    // Dark cloud
    svg.append('ellipse')
      .attr('cx', centerX)
      .attr('cy', centerY - 5)
      .attr('rx', 22)
      .attr('ry', 14)
      .attr('fill', '#445566');

    // Lightning bolt
    svg.append('polygon')
      .attr('points', `${centerX},${centerY + 5} ${centerX - 5},${centerY + 15} ${centerX + 2},${centerY + 15} ${centerX - 3},${centerY + 28} ${centerX + 8},${centerY + 12} ${centerX + 2},${centerY + 12}`)
      .attr('fill', '#ffdd00');
  } else if (cond.includes('fog') || cond.includes('mist')) {
    // Fog lines
    for (let i = 0; i < 4; i++) {
      svg.append('line')
        .attr('x1', centerX - 20)
        .attr('x2', centerX + 20)
        .attr('y1', centerY - 12 + i * 8)
        .attr('y2', centerY - 12 + i * 8)
        .attr('stroke', '#aabbcc')
        .attr('stroke-width', 3)
        .attr('stroke-linecap', 'round')
        .attr('opacity', 0.7 - i * 0.1);
    }
  } else {
    // Default: partly cloudy
    svg.append('circle')
      .attr('cx', centerX - 5)
      .attr('cy', centerY - 5)
      .attr('r', 12)
      .attr('fill', '#ffdd00');

    svg.append('ellipse')
      .attr('cx', centerX + 8)
      .attr('cy', centerY + 5)
      .attr('rx', 16)
      .attr('ry', 10)
      .attr('fill', '#aabbcc');
  }

  return d3n.svgString();
}

// ============================================================================
// Candlestick Chart
// ============================================================================

export function generateCandlestickChartSVG(data: CandlestickData, options: ChartOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { width, height, padding } = opts;
  const p = padding!;

  const d3n = new D3Node();
  const d3 = d3n.d3;

  const svg = d3n.createSVG(width, height);

  // Background
  svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', opts.backgroundColor);

  const chartWidth = width! - p.left - p.right;
  const chartHeight = height! - p.top - p.bottom;

  const candles = data.candles;
  if (candles.length === 0) return d3n.svgString();

  const allPrices = candles.flatMap(c => [c.high, c.low]);
  const minVal = Math.min(...allPrices);
  const maxVal = Math.max(...allPrices);
  const range = maxVal - minVal || 1;

  // Scales
  const xScale = d3.scaleLinear()
    .domain([0, candles.length - 1])
    .range([p.left, width! - p.right]);

  const yScale = d3.scaleLinear()
    .domain([minVal - range * 0.1, maxVal + range * 0.1])
    .range([height! - p.bottom, p.top]);

  const candleWidth = (chartWidth / candles.length) * 0.6;

  // Grid
  if (opts.showGrid) {
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const y = p.top + (chartHeight / yTicks) * i;
      svg.append('line')
        .attr('x1', p.left)
        .attr('x2', width! - p.right)
        .attr('y1', y)
        .attr('y2', y)
        .attr('stroke', opts.gridColor)
        .attr('stroke-width', 0.5);
    }
  }

  // Draw candles
  candles.forEach((candle, i) => {
    const x = xScale(i);
    const isUp = candle.close >= candle.open;
    const color = isUp ? '#00ff88' : '#ff4444';

    const highY = yScale(candle.high);
    const lowY = yScale(candle.low);
    const openY = yScale(candle.open);
    const closeY = yScale(candle.close);

    // Wick (high-low line)
    svg.append('line')
      .attr('x1', x)
      .attr('x2', x)
      .attr('y1', highY)
      .attr('y2', lowY)
      .attr('stroke', color)
      .attr('stroke-width', 1);

    // Body (open-close rectangle)
    const bodyTop = Math.min(openY, closeY);
    const bodyHeight = Math.abs(closeY - openY) || 1;

    svg.append('rect')
      .attr('x', x - candleWidth / 2)
      .attr('y', bodyTop)
      .attr('width', candleWidth)
      .attr('height', bodyHeight)
      .attr('fill', color)
      .attr('stroke', color)
      .attr('stroke-width', 1);
  });

  // Y-axis labels
  if (opts.showLabels) {
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const val = minVal + (range / yTicks) * (yTicks - i);
      const y = p.top + (chartHeight / yTicks) * i;
      svg.append('text')
        .attr('x', p.left - 5)
        .attr('y', y + 4)
        .attr('text-anchor', 'end')
        .attr('fill', opts.textColor)
        .attr('font-size', '10px')
        .attr('font-family', 'monospace')
        .text(formatNumber(val));
    }

    // X-axis labels (dates)
    const step = Math.max(1, Math.ceil(candles.length / 6));
    candles.forEach((candle, i) => {
      if (i % step === 0 || i === candles.length - 1) {
        svg.append('text')
          .attr('x', xScale(i))
          .attr('y', height! - p.bottom + 15)
          .attr('text-anchor', 'middle')
          .attr('fill', opts.textColor)
          .attr('font-size', '9px')
          .attr('font-family', 'monospace')
          .text(candle.date.slice(5)); // MM-DD format
      }
    });
  }

  // Title
  if (opts.title) {
    svg.append('text')
      .attr('x', width! / 2)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .attr('fill', opts.textColor)
      .attr('font-size', '12px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold')
      .text(opts.title);
  }

  return d3n.svgString();
}

// ============================================================================
// Pie Chart
// ============================================================================

export function generatePieChartSVG(data: PieChartData, options: ChartOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, width: 300, height: 300, ...options };
  const { width, height } = opts;

  const d3n = new D3Node();
  const d3 = d3n.d3;

  const svg = d3n.createSVG(width, height);

  // Background
  svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', opts.backgroundColor);

  const radius = Math.min(width!, height!) / 2 - 40;
  const centerX = width! / 2;
  const centerY = height! / 2;

  const total = data.slices.reduce((sum, s) => sum + s.value, 0);

  const pie = d3.pie<{ label: string; value: number; color?: string }>()
    .value((d: { label: string; value: number; color?: string }) => d.value)
    .sort(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arc = d3.arc<any>()
    .innerRadius(0)
    .outerRadius(radius);

  const defaultColors = ['#00ff88', '#ff4444', '#4488ff', '#ffaa00', '#ff88ff', '#88ffff', '#88ff88'];

  const pieData = pie(data.slices);
  const g = svg.append('g')
    .attr('transform', `translate(${centerX}, ${centerY})`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pieData.forEach((d: any, i: number) => {
    g.append('path')
      .attr('d', arc(d))
      .attr('fill', d.data.color || defaultColors[i % defaultColors.length])
      .attr('stroke', opts.backgroundColor)
      .attr('stroke-width', 2);

    const centroid = arc.centroid(d);
    const percent = (d.data.value / total * 100).toFixed(1);
    g.append('text')
      .attr('transform', `translate(${centroid[0]}, ${centroid[1]})`)
      .attr('text-anchor', 'middle')
      .attr('fill', opts.textColor)
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .text(percent + '%');
  });

  // Legend
  const legend = svg.append('g')
    .attr('transform', `translate(${width! - 100}, 20)`);

  data.slices.forEach((slice, i) => {
    const y = i * 20;
    const color = slice.color || defaultColors[i % defaultColors.length];

    legend.append('rect')
      .attr('x', 0)
      .attr('y', y)
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', color);

    legend.append('text')
      .attr('x', 18)
      .attr('y', y + 10)
      .attr('fill', opts.textColor)
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .text(slice.label);
  });

  // Title
  if (opts.title) {
    svg.append('text')
      .attr('x', width! / 2)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .attr('fill', opts.textColor)
      .attr('font-size', '12px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold')
      .text(opts.title);
  }

  return d3n.svgString();
}

// ============================================================================
// Gauge Chart (for Fear & Greed, etc.)
// ============================================================================

export function generateGaugeChartSVG(data: GaugeData, options: ChartOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, width: 200, height: 150, ...options };
  const { width, height } = opts;

  const d3n = new D3Node();
  const svg = d3n.createSVG(width, height);

  const min = data.min ?? 0;
  const max = data.max ?? 100;
  const value = Math.max(min, Math.min(max, data.value));

  // Background
  svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', opts.backgroundColor);

  const d3 = d3n.d3;
  const centerX = width! / 2;
  const centerY = height! - 30;
  const radius = Math.min(width!, height!) - 40;

  // Arc generator for gauge background
  const arcBg = d3.arc<{ startAngle: number; endAngle: number }>()
    .innerRadius(radius * 0.7)
    .outerRadius(radius)
    .startAngle(-Math.PI / 2)
    .endAngle(Math.PI / 2);

  // Background arc (gray)
  svg.append('path')
    .attr('transform', `translate(${centerX}, ${centerY})`)
    .attr('d', arcBg({ startAngle: -Math.PI / 2, endAngle: Math.PI / 2 }))
    .attr('fill', '#333355');

  // Colored segments
  const segments = 5;
  const segmentColors = ['#ff4444', '#ff8844', '#ffaa00', '#88ff44', '#00ff88'];
  for (let i = 0; i < segments; i++) {
    const startAngle = -Math.PI / 2 + (Math.PI * i / segments);
    const endAngle = -Math.PI / 2 + (Math.PI * (i + 1) / segments);

    const arcSegment = d3.arc<{ startAngle: number; endAngle: number }>()
      .innerRadius(radius * 0.7)
      .outerRadius(radius)
      .startAngle(startAngle)
      .endAngle(endAngle);

    svg.append('path')
      .attr('transform', `translate(${centerX}, ${centerY})`)
      .attr('d', arcSegment({ startAngle, endAngle }))
      .attr('fill', segmentColors[i])
      .attr('opacity', 0.8);
  }

  // Needle
  const percent = (value - min) / (max - min);
  const needleAngle = -Math.PI / 2 + Math.PI * percent;

  const needleLength = radius * 0.85;
  const needleX = centerX + needleLength * Math.cos(needleAngle);
  const needleY = centerY + needleLength * Math.sin(needleAngle);

  svg.append('line')
    .attr('x1', centerX)
    .attr('y1', centerY)
    .attr('x2', needleX)
    .attr('y2', needleY)
    .attr('stroke', '#ffffff')
    .attr('stroke-width', 3)
    .attr('stroke-linecap', 'round');

  // Center circle
  svg.append('circle')
    .attr('cx', centerX)
    .attr('cy', centerY)
    .attr('r', 6)
    .attr('fill', '#ffffff');

  // Value text
  svg.append('text')
    .attr('x', centerX)
    .attr('y', centerY - 20)
    .attr('text-anchor', 'middle')
    .attr('fill', opts.textColor)
    .attr('font-size', '24px')
    .attr('font-family', 'monospace')
    .attr('font-weight', 'bold')
    .text(Math.round(value));

  // Min/Max labels
  svg.append('text')
    .attr('x', centerX - radius * 0.7)
    .attr('y', centerY + 5)
    .attr('text-anchor', 'middle')
    .attr('fill', opts.textColor)
    .attr('font-size', '10px')
    .attr('font-family', 'monospace')
    .text(min);

  svg.append('text')
    .attr('x', centerX + radius * 0.7)
    .attr('y', centerY + 5)
    .attr('text-anchor', 'middle')
    .attr('fill', opts.textColor)
    .attr('font-size', '10px')
    .attr('font-family', 'monospace')
    .text(max);

  // Label
  if (data.label) {
    svg.append('text')
      .attr('x', centerX)
      .attr('y', height! - 5)
      .attr('text-anchor', 'middle')
      .attr('fill', opts.textColor)
      .attr('font-size', '12px')
      .attr('font-family', 'monospace')
      .text(data.label);
  }

  // Title
  if (opts.title) {
    svg.append('text')
      .attr('x', centerX)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .attr('fill', opts.textColor)
      .attr('font-size', '12px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold')
      .text(opts.title);
  }

  return d3n.svgString();
}

// ============================================================================
// Sparkline (compact)
// ============================================================================

export function generateSparklineSVG(values: number[], options: ChartOptions = {}): string {
  const opts = {
    ...DEFAULT_OPTIONS,
    width: 100,
    height: 30,
    showGrid: false,
    showLabels: false,
    padding: { top: 5, right: 5, bottom: 5, left: 5 },
    ...options
  };
  const { width, height, padding } = opts;
  const p = padding!;

  const d3n = new D3Node();
  const d3 = d3n.d3;

  const svg = d3n.createSVG(width, height);

  // Transparent background for sparkline
  svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', opts.backgroundColor || 'transparent');

  if (values.length < 2) return d3n.svgString();

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  const xScale = d3.scaleLinear()
    .domain([0, values.length - 1])
    .range([p.left, width! - p.right]);

  const yScale = d3.scaleLinear()
    .domain([minVal, maxVal])
    .range([height! - p.bottom, p.top]);

  // Determine color based on trend
  const isUp = values[values.length - 1] >= values[0];
  const lineColor = opts.lineColor || (isUp ? '#00ff88' : '#ff4444');

  // Area
  const area = d3.area<number>()
    .x((_d: number, i: number) => xScale(i))
    .y0(height! - p.bottom)
    .y1((d: number) => yScale(d));

  svg.append('path')
    .datum(values)
    .attr('fill', lineColor)
    .attr('fill-opacity', 0.2)
    .attr('d', area);

  // Line
  const line = d3.line<number>()
    .x((_d: number, i: number) => xScale(i))
    .y((d: number) => yScale(d));

  svg.append('path')
    .datum(values)
    .attr('fill', 'none')
    .attr('stroke', lineColor)
    .attr('stroke-width', 1.5)
    .attr('d', line);

  // End point
  svg.append('circle')
    .attr('cx', xScale(values.length - 1))
    .attr('cy', yScale(values[values.length - 1]))
    .attr('r', 2)
    .attr('fill', lineColor);

  return d3n.svgString();
}

// ============================================================================
// SVG to Terminal Image
// ============================================================================

export async function svgToTerminalImage(
  svgString: string,
  options: { width?: string | number; height?: string | number } = {}
): Promise<string> {
  try {
    // Convert SVG to PNG using resvg-js (faster and more accurate than sharp for SVG)
    const resvg = new Resvg(svgString, {
      fitTo: {
        mode: 'original',
      },
      font: {
        loadSystemFonts: false, // Faster rendering
      },
    });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    // Convert to terminal image
    return await terminalImage.buffer(pngBuffer, {
      width: options.width || '50%',
      height: options.height,
      preserveAspectRatio: true,
    });
  } catch {
    // Fallback: return ASCII representation
    return '[Chart rendering failed - terminal may not support graphics]';
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatNumber(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M';
  }
  if (Math.abs(value) >= 1000) {
    return (value / 1000).toFixed(1) + 'K';
  }
  if (Math.abs(value) < 1) {
    return value.toFixed(4);
  }
  return value.toFixed(2);
}

// ============================================================================
// Convenience Functions
// ============================================================================

export async function renderLineChart(
  data: LineChartData,
  chartOptions?: ChartOptions,
  displayOptions?: { width?: string | number }
): Promise<string> {
  const svg = generateLineChartSVG(data, chartOptions);
  return svgToTerminalImage(svg, displayOptions);
}

export async function renderBarChart(
  data: BarChartData,
  chartOptions?: ChartOptions,
  displayOptions?: { width?: string | number }
): Promise<string> {
  const svg = generateBarChartSVG(data, chartOptions);
  return svgToTerminalImage(svg, displayOptions);
}

export async function renderTemperatureGauge(
  data: GaugeData,
  chartOptions?: ChartOptions,
  displayOptions?: { width?: string | number }
): Promise<string> {
  const svg = generateTemperatureGaugeSVG(data, chartOptions);
  return svgToTerminalImage(svg, displayOptions);
}

export async function renderWeatherIcon(
  condition: string,
  chartOptions?: ChartOptions,
  displayOptions?: { width?: string | number }
): Promise<string> {
  const svg = generateWeatherIconSVG(condition, chartOptions);
  return svgToTerminalImage(svg, displayOptions);
}

export async function renderSparkline(
  values: number[],
  chartOptions?: ChartOptions,
  displayOptions?: { width?: string | number }
): Promise<string> {
  const svg = generateSparklineSVG(values, chartOptions);
  return svgToTerminalImage(svg, displayOptions);
}

export async function renderCandlestickChart(
  data: CandlestickData,
  chartOptions?: ChartOptions,
  displayOptions?: { width?: string | number }
): Promise<string> {
  const svg = generateCandlestickChartSVG(data, chartOptions);
  return svgToTerminalImage(svg, displayOptions);
}

export async function renderPieChart(
  data: PieChartData,
  chartOptions?: ChartOptions,
  displayOptions?: { width?: string | number }
): Promise<string> {
  const svg = generatePieChartSVG(data, chartOptions);
  return svgToTerminalImage(svg, displayOptions);
}

export async function renderGaugeChart(
  data: GaugeData,
  chartOptions?: ChartOptions,
  displayOptions?: { width?: string | number }
): Promise<string> {
  const svg = generateGaugeChartSVG(data, chartOptions);
  return svgToTerminalImage(svg, displayOptions);
}
