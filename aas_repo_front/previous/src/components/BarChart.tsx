"use client";

import { Bar } from "react-chartjs-2";
import { ChartData, ChartOptions } from "chart.js";

interface BarChartProps {
  data: ChartData<"bar">;
}

const options: ChartOptions<"bar"> = {
  indexAxis: 'y' as const, // 수평 막대그래프
  elements: {
    bar: {
      borderWidth: 2,
    },
  },
  responsive: true,
  plugins: {
    legend: {
      display: false, // 범례 숨기기
    },
  },
};

export default function BarChart({ data }: BarChartProps) {
  return <Bar data={data} options={options} />;
}