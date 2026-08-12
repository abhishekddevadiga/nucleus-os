import { withUser, ok, body } from "@/lib/api";
import { createProject, type CreateProjectInput } from "@/lib/projects";

export const POST = withUser(async (req, user) => {
  const input = await body<CreateProjectInput>(req);
  const project = await createProject(user, input);
  return ok({ id: project.id });
});
