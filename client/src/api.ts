import { FileRequest, ProjectResponse, RequestType } from './types';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const handleResponse = async (response: Response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.message || '请求失败';
    throw new Error(message);
  }
  return data;
};

export const fetchProjects = async (): Promise<ProjectResponse> => {
  const resp = await fetch(`${API_BASE}/projects`);
  return handleResponse(resp);
};

interface UploadPayload {
  file: File;
  path?: string;
  token?: string;
}

export const uploadHtml = async ({ file, path, token }: UploadPayload) => {
  const formData = new FormData();
  formData.append('file', file);
  if (path) {
    formData.append('path', path);
  }
  if (token) {
    formData.append('token', token);
  }
  const resp = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse(resp);
};

interface PermissionPayload {
  path: string;
  type: RequestType;
  name?: string;
  email?: string;
}

export const requestPermission = async (payload: PermissionPayload) => {
  const resp = await fetch(`${API_BASE}/request-permission`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(resp);
};

export const deleteFile = async ({ path, token }: { path: string; token: string }) => {
  const resp = await fetch(`${API_BASE}/files`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, token }),
  });
  return handleResponse(resp);
};

export const loginAdmin = async ({ username, password }: { username: string; password: string }) => {
  const resp = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return handleResponse(resp);
};

export const fetchAdminRequests = async (token: string): Promise<{ requests: FileRequest[] }> => {
  const resp = await fetch(`${API_BASE}/admin/requests`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return handleResponse(resp);
};

export const approveRequest = async (
  token: string,
  payload: { requestId: number; action: 'APPROVE' | 'REJECT' },
) => {
  const resp = await fetch(`${API_BASE}/admin/approve`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(resp);
};
