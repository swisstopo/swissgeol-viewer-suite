import { CreateProject, Project, Topic } from './ngm-dashboard';
import AuthStore from '../../store/auth';

export function isProject(
  projectOrTopic: Project | CreateProject | Topic | undefined,
): projectOrTopic is Project {
  const project = <Project>projectOrTopic;
  return !!project?.owner && !!project?.created;
}

export function isProjectOwnerOrEditor(
  projectOrTopic: Project | Topic,
): boolean {
  const isOwner =
    isProject(projectOrTopic) &&
    projectOrTopic.owner.email === AuthStore.userEmail;
  const isEditor =
    isProject(projectOrTopic) &&
    !!projectOrTopic.editors?.find((e) => e.email === AuthStore.userEmail);
  return isOwner || isEditor;
}
