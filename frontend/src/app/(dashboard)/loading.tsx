function Bar({ w, delay = 0, h = "h-4" }: { w: string; delay?: number; h?: string }) {
  return (
    <div
      className={`shimmer-bg rounded-md ${h} ${w}`}
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-page-in">
      {/* Page header */}
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Bar w="w-44" h="h-7" />
          <Bar w="w-28" delay={40} />
        </div>
        <Bar w="w-32" h="h-9" delay={60} />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="shimmer-bg rounded-lg h-[88px]"
            style={{ animationDelay: `${80 + i * 55}ms` }}
          />
        ))}
      </div>

      {/* Toolbar / filters */}
      <div className="flex gap-3">
        <Bar w="flex-1" h="h-9" delay={280} />
        <Bar w="w-28" h="h-9" delay={310} />
        <Bar w="w-24" h="h-9" delay={330} />
      </div>

      {/* Table rows — fading out toward bottom */}
      <div className="space-y-2">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div
            key={i}
            className="shimmer-bg rounded-lg h-12"
            style={{
              animationDelay: `${360 + i * 35}ms`,
              opacity: Math.max(0.18, 1 - i * 0.11),
            }}
          />
        ))}
      </div>
    </div>
  );
}
