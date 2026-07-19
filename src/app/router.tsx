import { Route, Routes } from "react-router-dom";
import type { CloudSyncController } from "../features/todos/hooks/useCloudSync";
import type { TodoOperationResult } from "../features/todos/hooks/useTodos";
import type {
  TodoDraft,
  TodoItem,
  TodoPayload,
} from "../features/todos/types/todos";
import type { LocalAppEnvelope } from "../lib/local-data/envelope";
import type { StorageSizeInfo } from "../lib/local-data/storage-size";
import Home from "../pages/Home";
import NotFound from "../pages/NotFound";
import Settings from "../pages/Settings";

interface AppRouterProps {
  todos: TodoItem[];
  envelope: LocalAppEnvelope<TodoPayload> | null;
  storageSize: StorageSizeInfo;
  cloudSync: CloudSyncController;
  onAddTodo: (draft: TodoDraft) => TodoOperationResult;
  onAddSuggestedTodos: (titles: string[]) => TodoOperationResult;
  onToggleTodo: (id: string) => TodoOperationResult;
  onRemoveTodo: (id: string) => TodoOperationResult;
  onClearCompleted: () => TodoOperationResult;
  onExportData: () => TodoOperationResult<string>;
  onExportLatestBackup: () => TodoOperationResult<string>;
  onImportData: (raw: string) => TodoOperationResult;
  onResetData: () => TodoOperationResult;
}

const AppRouter = ({
  todos,
  envelope,
  storageSize,
  cloudSync,
  onAddTodo,
  onAddSuggestedTodos,
  onToggleTodo,
  onRemoveTodo,
  onClearCompleted,
  onExportData,
  onExportLatestBackup,
  onImportData,
  onResetData,
}: AppRouterProps) => (
  <Routes>
    <Route
      path="/"
      element={
        <Home
          todos={todos}
          onAddTodo={onAddTodo}
          onAddSuggestedTodos={onAddSuggestedTodos}
          onToggleTodo={onToggleTodo}
          onRemoveTodo={onRemoveTodo}
          onClearCompleted={onClearCompleted}
        />
      }
    />
    <Route
      path="/settings"
      element={
        <Settings
          envelope={envelope}
          storageSize={storageSize}
          cloudSync={cloudSync}
          onExportData={onExportData}
          onExportLatestBackup={onExportLatestBackup}
          onImportData={onImportData}
          onResetData={onResetData}
        />
      }
    />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

export default AppRouter;
