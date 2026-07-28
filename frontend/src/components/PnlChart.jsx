import { useMemo, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

export default function PnlChart({ series }) {
  const chartRef = useRef(null);

  const data = useMemo(
    () => ({
      labels: series.labels,
      datasets: [
        {
          data: series.data,
          borderColor: '#8fba7a',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: '#8fba7a',
          pointHoverBorderColor: '#0b0f0a',
          pointHoverBorderWidth: 2,
          backgroundColor: (ctx) => {
            const { chart } = ctx;
            const { ctx: c, chartArea } = chart;
            if (!chartArea) return 'rgba(143,186,122,0.1)';
            const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(143,186,122,0.18)');
            gradient.addColorStop(1, 'rgba(143,186,122,0)');
            return gradient;
          },
        },
      ],
    }),
    [series]
  );

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#181f15',
        borderColor: '#222b1e',
        borderWidth: 1,
        titleColor: '#5a5a7a',
        bodyColor: '#8fba7a',
        titleFont: { family: 'JetBrains Mono', size: 10 },
        bodyFont: { family: 'JetBrains Mono', size: 13, weight: '600' },
        callbacks: { label: (ctx) => `${ctx.parsed.y >= 0 ? '+' : ''}$${ctx.parsed.y.toLocaleString()}` },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: '#3a3a55', font: { family: 'JetBrains Mono', size: 9 }, maxTicksLimit: 6 },
      },
      y: {
        grid: { color: 'rgba(30,30,46,0.8)' },
        border: { display: false },
        ticks: {
          color: '#3a3a55',
          font: { family: 'JetBrains Mono', size: 9 },
          callback: (v) => `$${Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`,
        },
      },
    },
    interaction: { mode: 'index', intersect: false },
  };

  if (!series.data.length) {
    return <div className="empty-state">No trades in this period yet.</div>;
  }

  return (
    <div className="chart-container">
      <Line ref={chartRef} data={data} options={options} />
    </div>
  );
}
