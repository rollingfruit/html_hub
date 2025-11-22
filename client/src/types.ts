export interface Project {
  id: number;
  path: string;
  owner: string;
  url: string;
  createdAt: string;
}

export interface TreeNode {
  name: string;
  path: string;
  isFile: boolean;
  project?: Project;
  meta?: DirectoryMeta;
  children: TreeNode[];
}

export type RequestType = 'MODIFY' | 'DELETE';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface FileRequest {
  id: number;
  projectPath: string;
  requestType: RequestType;
  requesterName?: string | null;
  requesterEmail?: string | null;
  reason?: string | null;
  status: RequestStatus;
  accessToken?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface ProjectResponse {
  projects: Project[];
  tree: TreeNode[];
  directories: string[];
  directoryMeta: DirectoryMeta[];
}

export interface DirectoryMeta {
  id?: number;
  path: string;
  systemPrompt: string;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
