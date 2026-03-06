import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ApiError,
  createTodo,
  deleteTodo,
  getSession,
  getTodoPathSetting,
  listTodos,
  SessionInfo,
  signInEmail,
  signOut,
  signUpEmail,
  Todo,
  updateTodo,
} from './lib/api';

type AuthMode = 'signin' | 'signup';

interface TodoFormState {
  name: string;
  description: string;
  isActive: boolean;
}

const EMPTY_TODO_FORM: TodoFormState = {
  name: '',
  description: '',
  isActive: true,
};

function formatError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return `${error.message} (HTTP ${error.status})`;
  if (error instanceof Error) return error.message;
  return fallback;
}

function formatDate(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function App() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [authError, setAuthError] = useState('');
  const [todosPath, setTodosPath] = useState(getTodoPathSetting());
  const [todos, setTodos] = useState<Todo[]>([]);
  const [todosLoading, setTodosLoading] = useState(false);
  const [todosError, setTodosError] = useState('');
  const [todoMessage, setTodoMessage] = useState('');
  const [todoFormBusy, setTodoFormBusy] = useState(false);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [todoForm, setTodoForm] = useState<TodoFormState>(EMPTY_TODO_FORM);
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    password: '',
  });

  const sessionLabel = useMemo(() => {
    if (sessionLoading) return 'Checking session...';
    if (!session?.user) return 'No active session';
    const role = session.user.role ? ` (${session.user.role})` : '';
    return `${session.user.email ?? session.user.name ?? 'Signed in'}${role}`;
  }, [session, sessionLoading]);

  async function refreshSession(): Promise<SessionInfo | null> {
    try {
      setSessionLoading(true);
      const data = await getSession();
      setSession(data);
      return data;
    } catch (error) {
      setSession(null);
      setAuthError(formatError(error, 'Unable to fetch session'));
      return null;
    } finally {
      setSessionLoading(false);
    }
  }

  async function loadTodos(): Promise<void> {
    try {
      setTodosLoading(true);
      setTodosError('');
      const result = await listTodos();
      setTodos(result.todos);
      setTodosPath(result.pathUsed);
    } catch (error) {
      setTodos([]);
      setTodosError(formatError(error, 'Unable to load todos'));
    } finally {
      setTodosLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      const activeSession = await refreshSession();
      if (activeSession?.user) {
        await loadTodos();
      }
    })();
  }, []);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setAuthError('');
    setAuthMessage('');

    try {
      setAuthBusy(true);

      if (authMode === 'signin') {
        await signInEmail(authForm.email.trim(), authForm.password);
        setAuthMessage('Signed in successfully.');
      } else {
        await signUpEmail(authForm.name.trim(), authForm.email.trim(), authForm.password);
        setAuthMessage('Account created and signed in.');
      }

      setAuthForm({ name: '', email: '', password: '' });
      const activeSession = await refreshSession();
      if (activeSession?.user) await loadTodos();
    } catch (error) {
      setAuthError(formatError(error, 'Authentication failed'));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut(): Promise<void> {
    setAuthError('');
    setAuthMessage('');

    try {
      setAuthBusy(true);
      await signOut();
      setSession(null);
      setTodos([]);
      setAuthMessage('Signed out.');
    } catch (error) {
      setAuthError(formatError(error, 'Sign out failed'));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleTodoSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setTodoMessage('');
    setTodosError('');

    try {
      setTodoFormBusy(true);
      const payload = {
        name: todoForm.name.trim(),
        description: todoForm.description.trim(),
        isActive: todoForm.isActive,
      };

      if (!payload.name) {
        setTodosError('Todo name is required.');
        return;
      }

      if (editingTodoId) {
        await updateTodo(editingTodoId, payload, todosPath);
        setTodoMessage('Todo updated.');
      } else {
        await createTodo(payload, todosPath);
        setTodoMessage('Todo created.');
      }

      setEditingTodoId(null);
      setTodoForm(EMPTY_TODO_FORM);
      await loadTodos();
    } catch (error) {
      setTodosError(formatError(error, 'Todo save failed'));
    } finally {
      setTodoFormBusy(false);
    }
  }

  function startEditing(todo: Todo): void {
    setEditingTodoId(todo.id);
    setTodoForm({
      name: todo.name,
      description: todo.description ?? '',
      isActive: todo.isActive,
    });
  }

  function cancelEditing(): void {
    setEditingTodoId(null);
    setTodoForm(EMPTY_TODO_FORM);
  }

  async function handleDelete(todoId: string): Promise<void> {
    setTodoMessage('');
    setTodosError('');

    try {
      setTodoFormBusy(true);
      await deleteTodo(todoId, todosPath);
      setTodoMessage('Todo deleted.');
      await loadTodos();
      if (editingTodoId === todoId) cancelEditing();
    } catch (error) {
      setTodosError(formatError(error, 'Delete failed'));
    } finally {
      setTodoFormBusy(false);
    }
  }

  async function toggleStatus(todo: Todo): Promise<void> {
    setTodoMessage('');
    setTodosError('');

    try {
      setTodoFormBusy(true);
      await updateTodo(
        todo.id,
        {
          name: todo.name,
          description: todo.description,
          isActive: !todo.isActive,
        },
        todosPath
      );
      setTodoMessage('Todo status updated.');
      await loadTodos();
    } catch (error) {
      setTodosError(formatError(error, 'Status update failed'));
    } finally {
      setTodoFormBusy(false);
    }
  }

  return (
    <main className="shell">
      <section className="panel-grid">
        <article className="panel">
          <div className="panel-head">
            <h2>Auth</h2>
            {session?.user ? (
              <button className="ghost" onClick={() => void handleSignOut()} disabled={authBusy}>
                Sign out
              </button>
            ) : null}
          </div>
          <p className="hint">Session: {sessionLabel}</p>

          {!session?.user ? (
            <>
              <div className="tabs">
                <button
                  className={authMode === 'signin' ? 'active' : ''}
                  onClick={() => setAuthMode('signin')}
                  type="button"
                >
                  Sign in
                </button>
                <button
                  className={authMode === 'signup' ? 'active' : ''}
                  onClick={() => setAuthMode('signup')}
                  type="button"
                >
                  Sign up
                </button>
              </div>

              <form className="stack" onSubmit={(event) => void handleAuthSubmit(event)}>
                {authMode === 'signup' ? (
                  <label>
                    Name
                    <input
                      required
                      value={authForm.name}
                      onChange={(event) => setAuthForm((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Akshat"
                    />
                  </label>
                ) : null}

                <label>
                  Email
                  <input
                    required
                    type="email"
                    value={authForm.email}
                    onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="you@example.com"
                  />
                </label>

                <label>
                  Password
                  <input
                    required
                    minLength={6}
                    type="password"
                    value={authForm.password}
                    onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                    placeholder="At least 6 characters"
                  />
                </label>

                <button disabled={authBusy} type="submit">
                  {authBusy ? 'Please wait...' : authMode === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              </form>
            </>
          ) : (
            <div className="stack status">
              <p>
                Signed in as <strong>{session.user.email ?? session.user.name ?? 'user'}</strong>
              </p>
              <button className="ghost" onClick={() => void refreshSession()} disabled={sessionLoading}>
                {sessionLoading ? 'Refreshing...' : 'Refresh session'}
              </button>
            </div>
          )}

          {authMessage ? <p className="success">{authMessage}</p> : null}
          {authError ? <p className="error">{authError}</p> : null}
        </article>

        <article className="panel">
          <div className="panel-head">
            <h2>{editingTodoId ? 'Edit Todo' : 'Create Todo'}</h2>
            {editingTodoId ? (
              <button className="ghost" type="button" onClick={cancelEditing}>
                Cancel edit
              </button>
            ) : null}
          </div>

          <form className="stack" onSubmit={(event) => void handleTodoSubmit(event)}>
            <label>
              Name
              <input
                required
                value={todoForm.name}
                onChange={(event) => setTodoForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Plan release"
              />
            </label>

            <label>
              Description
              <textarea
                rows={3}
                value={todoForm.description}
                onChange={(event) => setTodoForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Optional details"
              />
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={todoForm.isActive}
                onChange={(event) => setTodoForm((prev) => ({ ...prev, isActive: event.target.checked }))}
              />
              Active
            </label>

            <button disabled={todoFormBusy || !session?.user} type="submit">
              {todoFormBusy ? 'Saving...' : editingTodoId ? 'Update todo' : 'Create todo'}
            </button>
          </form>

          <p className="hint">Create, update, and delete now require an authenticated session.</p>
          {todoMessage ? <p className="success">{todoMessage}</p> : null}
        </article>
      </section>

      <section className="panel todo-list">
        <div className="panel-head">
          <h2>Todos</h2>
          <button className="ghost" onClick={() => void loadTodos()} disabled={todosLoading}>
            {todosLoading ? 'Loading...' : 'Reload'}
          </button>
        </div>

        {todosError ? <p className="error">{todosError}</p> : null}

        {todos.length === 0 ? (
          <p className="empty">No records loaded yet.</p>
        ) : (
          <ul className="todo-cards">
            {todos.map((todo) => (
              <li key={todo.id}>
                <div className="todo-head">
                  <h3>{todo.name}</h3>
                  <span className={todo.isActive ? 'badge on' : 'badge off'}>
                    {todo.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p>{todo.description || 'No description'}</p>
                <small>Updated: {formatDate(todo.updatedAt ?? todo.createdAt)}</small>
                <div className="actions">
                  <button className="ghost" onClick={() => startEditing(todo)} disabled={todoFormBusy}>
                    Edit
                  </button>
                  <button className="ghost" onClick={() => void toggleStatus(todo)} disabled={todoFormBusy}>
                    Toggle status
                  </button>
                  <button className="danger" onClick={() => void handleDelete(todo.id)} disabled={todoFormBusy}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
