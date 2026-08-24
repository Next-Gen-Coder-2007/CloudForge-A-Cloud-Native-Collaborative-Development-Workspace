export interface EnvVariable {
  key: string;
  value: string;
}

export interface Project {
  _id: string;
  name: string;
  description: string;
  owner: string;
  currentBranch?: string;
  branches?: string[];
  envVariables?: EnvVariable[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectData {
  name: string;
  description: string;
  envVariables?: EnvVariable[];
}