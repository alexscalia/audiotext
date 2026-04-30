export default function AdminDashboardPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-black">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-500">
          Overview of your audiotext platform
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Active calls", value: "0" },
          { label: "Users", value: "0" },
          { label: "Trunks", value: "0" },
          { label: "Numbering plans", value: "0" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-md border border-gray-200 bg-white p-5"
          >
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-black">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-md border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-black">Recent activity</h2>
        <p className="mt-1 text-sm text-gray-500">No activity yet.</p>
      </div>
    </div>
  );
}
