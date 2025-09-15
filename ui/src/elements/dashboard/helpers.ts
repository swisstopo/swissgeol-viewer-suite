import { CreateProject, Project, Topic } from './ngm-dashboard';
import { User } from 'src/features/session';

export function isProject(
  projectOrTopic: Project | CreateProject | Topic | undefined,
): projectOrTopic is Project {
  const project = <Project>projectOrTopic;
  return !!project?.owner && !!project?.created;
}

export function isProjectOwnerOrEditor(
  user: User | null,
  projectOrTopic: Project | Topic,
): boolean {
  const isOwner =
    isProject(projectOrTopic) && projectOrTopic.owner.email === user?.email;
  const isEditor =
    isProject(projectOrTopic) &&
    !!projectOrTopic.editors?.find((e) => e.email === user?.email);
  return isOwner || isEditor;
}
