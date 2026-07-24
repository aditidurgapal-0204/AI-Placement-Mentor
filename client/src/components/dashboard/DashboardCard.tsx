interface DashboardCardProps {
  title: string;
  children: React.ReactNode;
}

export default function DashboardCard({
  title,
  children,
}: DashboardCardProps) {
  return (
    <div
      className="bg-[#111827] rounded-2xl p-6 border border-slate-800"
    >
      <h2 className="text-slate-400 text-sm font-medium mb-4">
        {title}
      </h2>

      {children}
    </div>
  );
}