import { DirectoryMeta, FileRequest, ProjectResponse, RequestStatus, RequestType } from './types';

type ApiError = Error & { status?: number; payload?: unknown };

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (import.meta.env.DEV ? 'http://127.0.0.1:3000/api' : '/api');

const parseResponseBody = async (response: Response) => {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    return {};
  }
};

const handleResponse = async (response: Response) => {
  const data = await parseResponseBody(response);
  if (!response.ok) {
    const message = data?.message || '请求失败';
    const error = new Error(message) as ApiError;
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return data;
};

export const fetchProjects = async (): Promise<ProjectResponse> => {
  const resp = await fetch(`${API_BASE}/projects`);
  return handleResponse(resp);
};

type UploadPayload =
  | {
    file: File;
    path?: string;
    token?: string;
    adminToken?: string;
  }
  | {
    content: string;
    filename: string;
    path?: string;
    token?: string;
    adminToken?: string;
  };

export const uploadHtml = async (payload: UploadPayload) => {
  const formData = new FormData();
  if ('file' in payload) {
    formData.append('file', payload.file);
  } else {
    formData.append('content', payload.content);
    formData.append('filename', payload.filename);
  }
  if (payload.path) formData.append('path', payload.path);
  if (payload.token) formData.append('token', payload.token);

  const headers = payload.adminToken ? { Authorization: `Bearer ${payload.adminToken}` } : undefined;

  const resp = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
    headers,
  });
  return handleResponse(resp);
};

export const fetchDirectoryMeta = async (path = ''): Promise<{ directory: DirectoryMeta }> => {
  const params = new URLSearchParams();
  params.set('path', path);
  const resp = await fetch(`${API_BASE}/directory?${params.toString()}`);
  return handleResponse(resp);
};

export const saveDirectoryMeta = async (payload: {
  path: string;
  systemPrompt: string;
  description?: string;
}): Promise<{ directory: DirectoryMeta }> => {
  const resp = await fetch(`${API_BASE}/directory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(resp);
};

export const createDirectory = async (payload: {
  path?: string;
  parentPath?: string;
  name?: string;
  systemPrompt?: string;
  description?: string;
}): Promise<{ directory: DirectoryMeta }> => {
  const resp = await fetch(`${API_BASE}/mkdir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(resp);
};

interface PermissionPayload {
  path: string;
  type: RequestType;
  name?: string;
  email?: string;
  reason: string;
  content?: string;
}

export const requestPermission = async (payload: PermissionPayload) => {
  const resp = await fetch(`${API_BASE}/request-permission`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(resp);
};



export const renameFile = async ({
  oldPath,
  newPath,
  adminToken,
}: {
  oldPath: string;
  newPath: string;
  adminToken?: string;
}) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (adminToken) {
    headers.Authorization = `Bearer ${adminToken}`;
  }
  const resp = await fetch(`${API_BASE}/files`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      oldPath,
      newPath,
    }),
  });
  return handleResponse(resp);
};

export const deleteFile = async ({
  path,
  adminToken,
}: {
  path: string;
  adminToken?: string;
}) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (adminToken) {
    headers.Authorization = `Bearer ${adminToken}`;
  }
  const resp = await fetch(`${API_BASE}/files`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({
      path,
    }),
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
  return handleResponse(resp) as Promise<{ message: string; request: FileRequest }>;
};

export const fetchLogs = async (
  token: string,
  page = 1,
  limit = 50,
): Promise<{ logs: any[]; total: number; page: number; totalPages: number }> => {
  const params = new URLSearchParams();
  params.set('page', page.toString());
  params.set('limit', limit.toString());
  const resp = await fetch(`${API_BASE}/admin/logs?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return handleResponse(resp);
};

export const moveFile = async ({
  oldPath,
  newPath,
  adminToken,
}: {
  oldPath: string;
  newPath: string;
  adminToken: string;
}) => {
  return renameFile({ oldPath, newPath, adminToken });
};
