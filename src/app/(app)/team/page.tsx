import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Avatar, SectionTitle, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [teamMembers, departments] = await Promise.all([
    db.user.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        avatarColor: true,
        title: true,
        department: { select: { name: true } },
        _count: { select: { assignedTasks: true } },
      },
    }),
    db.department.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Team</h1>
        <p className="text-sm text-slate-500 mt-1">
          Meet your team members and their departments.
        </p>
      </header>

      {teamMembers.length === 0 ? (
        <EmptyState title="No team members" hint="Invite people to join your team." />
      ) : (
        <>
          {/* Members by Department */}
          {departments.length > 0 && (
            <div className="space-y-6">
              {departments.map((dept) => {
                const deptMembers = teamMembers.filter(
                  (m) => m.department?.name === dept.name
                );
                if (deptMembers.length === 0) return null;

                return (
                  <section key={dept.id} className="card p-6">
                    <SectionTitle>{dept.name}</SectionTitle>
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                      {deptMembers.map((member) => (
                        <Link
                          key={member.id}
                          href={`/people/${member.id}`}
                          className="rounded-lg border border-slate-200 p-4 hover:border-brand-300 hover:bg-brand-50 transition-all"
                        >
                          <div className="flex items-start gap-3 mb-3">
                            <Avatar
                              name={member.name}
                              color={member.avatarColor}
                              size={9}
                            />
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-slate-900 truncate">
                                {member.name}
                              </h3>
                              <p className="text-xs text-slate-500 truncate">
                                {member.title || "Team member"}
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-slate-600 mb-2">{member.email}</p>
                          <p className="text-xs text-slate-500">
                            {member._count.assignedTasks}{" "}
                            {member._count.assignedTasks === 1 ? "task" : "tasks"}
                          </p>
                        </Link>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          {/* All Members */}
          {teamMembers.some((m) => !m.department?.name) && (
            <section className="card p-6">
              <SectionTitle>Unassigned Department</SectionTitle>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {teamMembers
                  .filter((m) => !m.department?.name)
                  .map((member) => (
                    <Link
                      key={member.id}
                      href={`/people/${member.id}`}
                      className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <Avatar
                          name={member.name}
                          color={member.avatarColor}
                          size={9}
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-slate-900 truncate">
                            {member.name}
                          </h3>
                          <p className="text-xs text-slate-500">{member.title || "Team member"}</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 mb-2">
                        {member.email}
                      </p>
                      <p className="text-xs text-slate-500">
                        {member._count.assignedTasks}{" "}
                        {member._count.assignedTasks === 1 ? "task" : "tasks"}
                      </p>
                    </Link>
                  ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Quick Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-600">Team Size</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {teamMembers.length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-600">Departments</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {departments.length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-600">Total Tasks</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {teamMembers.reduce((sum, m) => sum + m._count.assignedTasks, 0)}
          </p>
        </div>
      </div>
    </div>
  );
}
