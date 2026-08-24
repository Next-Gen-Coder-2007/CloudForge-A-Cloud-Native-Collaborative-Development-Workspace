import { type Project } from "../../types/project";
import ProjectCard from "./ProjectCard";

interface ProjectGridProps {
  projects: Project[];
  onDelete: (project: Project) => void;
  onEdit?: (project: Project) => void;
}

function ProjectGrid({
  projects,
  onDelete,
  onEdit,
}: ProjectGridProps) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {projects.map((project) => (
        <ProjectCard
          key={project._id}
          project={project}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}

export default ProjectGrid;