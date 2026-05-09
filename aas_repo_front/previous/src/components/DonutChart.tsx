"use client";

import { Doughnut } from "react-chartjs-2";
import { ChartData } from "chart.js";

interface DonutChartProps {
  data: ChartData<"doughnut">;
}

export default function DonutChart({ data }: DonutChartProps) {
  return <Doughnut data={data} />;
}