import { useCallback, useRef, useState } from "react";
import { AppError, toAppError } from "../../../lib/errors/app-error";
import type { LocalAppEnvelope } from "../../../lib/local-data/envelope";
import type { StorageSizeInfo } from "../../../lib/local-data/storage-size";
import { createTodosRepository } from "../repository/todos-repository";
import { todoDraftSchema, todoTitleSchema } from "../schemas/todo-schema";
import type { TodoDraft, TodoPayload } from "../types/todos";

export type TodoOperationResult<T = undefined> =
  | { ok: true; value: T }
  | { ok: false; error: string };

interface TodosState {
  envelope: LocalAppEnvelope<TodoPayload> | null;
  error: AppError | null;
}

const readInitialState = (
  repository: ReturnType<typeof createTodosRepository>,
): TodosState => {
  try {
    return { envelope: repository.load(), error: null };
  } catch (error) {
    return {
      envelope: null,
      error: toAppError(error, "本地待办数据加载失败。"),
    };
  }
};

export const useTodos = () => {
  const repositoryRef = useRef<ReturnType<typeof createTodosRepository> | null>(
    null,
  );
  repositoryRef.current ??= createTodosRepository();
  const repository = repositoryRef.current;
  const [state, setState] = useState<TodosState>(() =>
    readInitialState(repository),
  );

  const setFailure = useCallback((error: unknown, fallback: string) => {
    const appError = toAppError(error, fallback);
    setState((current) => ({ ...current, error: appError }));
    return { ok: false, error: appError.message } as const;
  }, []);

  const commit = useCallback(
    (
      action: () => LocalAppEnvelope<TodoPayload>,
      fallback: string,
    ): TodoOperationResult => {
      try {
        const envelope = action();
        setState({ envelope, error: null });
        return { ok: true, value: undefined };
      } catch (error) {
        return setFailure(error, fallback);
      }
    },
    [setFailure],
  );

  const addTodo = useCallback(
    (draft: TodoDraft) => {
      const parsed = todoDraftSchema.safeParse(draft);
      if (!parsed.success) {
        return setFailure(
          parsed.error,
          parsed.error.issues[0]?.message ?? "待办信息无效。",
        );
      }
      return commit(() => {
        const timestamp = new Date().toISOString();
        return repository.update((payload) => ({
          ...payload,
          todos: [
            {
              id: crypto.randomUUID(),
              title: parsed.data.title,
              notes: parsed.data.notes,
              completed: false,
              createdAt: timestamp,
              updatedAt: timestamp,
              completedAt: null,
            },
            ...payload.todos,
          ],
        }));
      }, "待办添加失败。");
    },
    [commit, repository, setFailure],
  );

  const addSuggestedTodos = useCallback(
    (titles: string[]) => {
      const parsed = todoTitleSchema.array().min(1).max(6).safeParse(titles);
      if (!parsed.success) {
        return setFailure(parsed.error, "AI 子任务建议格式不正确。");
      }
      return commit(() => {
        const timestamp = new Date().toISOString();
        return repository.update((payload) => ({
          ...payload,
          todos: [
            ...parsed.data.map((title) => ({
              id: crypto.randomUUID(),
              title,
              notes: "由 DeepSeek 拆解建议创建",
              completed: false,
              createdAt: timestamp,
              updatedAt: timestamp,
              completedAt: null,
            })),
            ...payload.todos,
          ],
        }));
      }, "AI 子任务添加失败。");
    },
    [commit, repository, setFailure],
  );

  const toggleTodo = useCallback(
    (id: string) =>
      commit(() => {
        const timestamp = new Date().toISOString();
        return repository.update((payload) => {
          if (!payload.todos.some((todo) => todo.id === id)) {
            throw new AppError("DATA_VALIDATION_FAILED", "该待办已不存在。");
          }
          return {
            ...payload,
            todos: payload.todos.map((todo) =>
              todo.id === id
                ? {
                    ...todo,
                    completed: !todo.completed,
                    updatedAt: timestamp,
                    completedAt: todo.completed ? null : timestamp,
                  }
                : todo,
            ),
          };
        });
      }, "待办状态更新失败。"),
    [commit, repository],
  );

  const removeTodo = useCallback(
    (id: string) =>
      commit(
        () =>
          repository.update((payload) => {
            if (!payload.todos.some((todo) => todo.id === id)) {
              throw new AppError("DATA_VALIDATION_FAILED", "该待办已不存在。");
            }
            return {
              ...payload,
              todos: payload.todos.filter((todo) => todo.id !== id),
            };
          }),
        "待办删除失败。",
      ),
    [commit, repository],
  );

  const clearCompleted = useCallback(
    () =>
      commit(
        () =>
          repository.update((payload) => {
            if (!payload.todos.some((todo) => todo.completed)) {
              throw new AppError(
                "DATA_VALIDATION_FAILED",
                "当前没有已完成待办可清理。",
              );
            }
            return {
              ...payload,
              todos: payload.todos.filter((todo) => !todo.completed),
            };
          }),
        "已完成待办清理失败。",
      ),
    [commit, repository],
  );

  const importData = useCallback(
    (raw: string) => commit(() => repository.importJson(raw), "数据导入失败。"),
    [commit, repository],
  );
  const resetData = useCallback(
    () => commit(() => repository.reset(), "本地数据清空失败。"),
    [commit, repository],
  );
  const exportData = useCallback((): TodoOperationResult<string> => {
    try {
      return { ok: true, value: repository.exportJson() };
    } catch (error) {
      return setFailure(error, "数据导出失败。");
    }
  }, [repository, setFailure]);
  const exportLatestBackup = useCallback((): TodoOperationResult<string> => {
    try {
      const backup = repository.exportLatestBackupJson();
      if (!backup) {
        throw new AppError(
          "DATA_VALIDATION_FAILED",
          "当前还没有覆盖前的本地备份。",
        );
      }
      return { ok: true, value: backup };
    } catch (error) {
      return setFailure(error, "最近本地备份导出失败。");
    }
  }, [repository, setFailure]);
  const reload = useCallback(() => {
    setState(readInitialState(repository));
  }, [repository]);
  const dismissError = useCallback(() => {
    setState((current) => ({ ...current, error: null }));
  }, []);

  let storageSize: StorageSizeInfo = {
    bytes: 0,
    formatted: "0 B",
    level: "normal",
  };
  try {
    storageSize = repository.getStorageSize();
  } catch {
    // 主错误状态已提供恢复入口，容量读取失败不覆盖更具体的数据错误。
  }

  return {
    repository,
    todos: state.envelope?.payload.todos ?? [],
    envelope: state.envelope,
    storageSize,
    error: state.error,
    addTodo,
    addSuggestedTodos,
    toggleTodo,
    removeTodo,
    clearCompleted,
    importData,
    exportData,
    exportLatestBackup,
    resetData,
    reload,
    dismissError,
  };
};
