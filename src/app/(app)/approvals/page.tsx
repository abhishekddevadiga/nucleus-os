export default function ApprovalsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Approvals</h1>
        <p className="text-sm text-slate-500">Pending reviews and decisions.</p>
      </header>
      <div className="card p-6 text-center">
        <p className="text-slate-600">No pending approvals.</p>
      </div>
    </div>
  );
}
