export interface SessionUser {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
}

export interface SessionInfo {
  session?: {
    id?: string;
    expiresAt?: string;
  };
  user?: SessionUser;
}

export interface Todo {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TodoInput {
  name: string;
  description?: string;
  isActive: boolean;
}

interface JsonResponse<T = unknown> {
  response: Response;
  data: T | null;
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8040').replace(/\/$/, '');
const DEFAULT_TODOS_PATH = import.meta.env.VITE_TODOS_PATH ?? '/api/todoes';

function toAltTodoPath(path: string): string | null {
  if (path.endsWith('/todoes')) return path.replace(/\/todoes$/, '/todos');
  if (path.endsWith('/todos')) return path.replace(/\/todos$/, '/todoes');
  return null;
}

function buildTodoCandidates(): string[] {
  const fallback = toAltTodoPath(DEFAULT_TODOS_PATH);
  return fallback ? [DEFAULT_TODOS_PATH, fallback] : [DEFAULT_TODOS_PATH];
}

function normalizeSession(input: unknown): SessionInfo | null {
  if (!input || typeof input !== 'object') return null;
  return input as SessionInfo;
}

function normalizeTodo(input: unknown): Todo | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const id = typeof raw.id === 'string' ? raw.id : typeof raw._id === 'string' ? raw._id : null;
  if (!id) return null;

  return {
    id,
    name: typeof raw.name === 'string' ? raw.name : 'Untitled',
    description: typeof raw.description === 'string' ? raw.description : '',
    isActive: Boolean(raw.isActive),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
  };
}

function extractTodos(payload: unknown): Todo[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload.map(normalizeTodo).filter((todo): todo is Todo => Boolean(todo));
  if (typeof payload !== 'object') return [];

  const raw = payload as Record<string, unknown>;
  const docs = Array.isArray(raw.docs)
    ? raw.docs
    : Array.isArray(raw.data)
      ? raw.data
      : Array.isArray(raw.items)
        ? raw.items
        : [];

  return docs.map(normalizeTodo).filter((todo): todo is Todo => Boolean(todo));
}

function extractTodo(payload: unknown): Todo | null {
  if (!payload) return null;
  if (typeof payload !== 'object') return normalizeTodo(payload);

  const raw = payload as Record<string, unknown>;
  const docCandidate = raw.doc ?? raw.data ?? raw.item ?? payload;
  return normalizeTodo(docCandidate);
}

async function parseJson(response: Response): Promise<unknown | null> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return null;
  return response.json();
}

async function request<T = unknown>(path: string, init: RequestInit = {}): Promise<JsonResponse<T>> {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  const data = (await parseJson(response)) as T | null;
  return { response, data };
}

function throwIfNotOk(response: Response, body: unknown, fallback: string): void {
  if (response.ok) return;

  const fromBody =
    body && typeof body === 'object' && 'message' in body && typeof (body as Record<string, unknown>).message === 'string'
      ? ((body as Record<string, unknown>).message as string)
      : fallback;

  throw new ApiError(fromBody, response.status, body);
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export function getTodoPathSetting(): string {
  return DEFAULT_TODOS_PATH;
}

export async function getSession(): Promise<SessionInfo | null> {
  const { response, data } = await request('/api/auth/get-session');

  if (response.status === 401) return null;
  throwIfNotOk(response, data, 'Unable to fetch session');

  return normalizeSession(data);
}

export async function signInEmail(email: string, password: string): Promise<void> {
  const { response, data } = await request('/api/auth/sign-in/email', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  throwIfNotOk(response, data, 'Sign in failed');
}

export async function signUpEmail(name: string, email: string, password: string): Promise<void> {
  const { response, data } = await request('/api/auth/sign-up/email', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });

  throwIfNotOk(response, data, 'Sign up failed');
}

export async function signOut(): Promise<void> {
  const { response, data } = await request('/api/auth/sign-out', {
    method: 'POST',
  });

  throwIfNotOk(response, data, 'Sign out failed');
}

export async function listTodos(): Promise<{ todos: Todo[]; pathUsed: string }> {
  const candidates = buildTodoCandidates();

  for (const path of candidates) {
    const { response, data } = await request(path);
    if (response.status === 404) continue;
    throwIfNotOk(response, data, 'Unable to load todos');
    return { todos: extractTodos(data), pathUsed: path };
  }

  throw new ApiError(
    `Todo endpoint not found. Tried: ${candidates.join(', ')}`,
    404,
    { candidates }
  );
}

export async function createTodo(input: TodoInput, todosPath: string): Promise<Todo> {
  const { response, data } = await request(todosPath, {
    method: 'POST',
    body: JSON.stringify(input),
  });

  throwIfNotOk(response, data, 'Unable to create todo');
  const todo = extractTodo(data);
  if (!todo) throw new ApiError('API returned invalid todo payload', response.status, data);
  return todo;
}

export async function updateTodo(todoId: string, input: TodoInput, todosPath: string): Promise<Todo> {
  const { response, data } = await request(`${todosPath}/${todoId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

  throwIfNotOk(response, data, 'Unable to update todo');
  const todo = extractTodo(data);
  if (!todo) throw new ApiError('API returned invalid todo payload', response.status, data);
  return todo;
}

export async function deleteTodo(todoId: string, todosPath: string): Promise<void> {
  const { response, data } = await request(`${todosPath}/${todoId}`, {
    method: 'DELETE',
  });

  throwIfNotOk(response, data, 'Unable to delete todo');
}
