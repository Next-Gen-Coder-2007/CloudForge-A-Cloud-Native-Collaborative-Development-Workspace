export interface Project {
  _id: string;
  name: string;
  description: string;
  owner: string;
  currentBranch?: string;
  branches?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectData {
  name: string;
  description: string;
}