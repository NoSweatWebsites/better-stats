'use client'

import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'

interface SparklineProps {
  data: { value: number }[]
  color?: string
}

export function Sparkline({ data, color = 'var(--primary)' }: SparklineProps) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
        />
        <Tooltip
          contentStyle={{ display: 'none' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
