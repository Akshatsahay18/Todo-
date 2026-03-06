# my-api frontend

React + Vite frontend for the Arc backend in `../my-api`.

## Run

```bash
npm install
npm run dev
```

App runs on `http://localhost:3000`.

## Environment

Create `.env` from `.env.example` if needed:

```env
VITE_API_BASE_URL=http://localhost:8040
VITE_TODOS_PATH=/api/todoes
```

- `VITE_API_BASE_URL`: backend host
- `VITE_TODOS_PATH`: Arc todo collection route. Keep `/api/todoes` for current resource naming.

## Build

```bash
npm run build
npm run preview
```
