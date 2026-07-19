import { APP_CONFIG } from "../../../config/app-config";
import { AppError } from "../../../lib/errors/app-error";
import { BrowserLocalDataRepository } from "../../../lib/local-data/local-data-repository";
import {
  legacyAppsSchema,
  todoPayloadSchema,
  versionOnePayloadSchema,
} from "../schemas/todo-schema";
import type { TodoItem, TodoPayload } from "../types/todos";

const LEGACY_STORAGE_KEY = "gipsy-apps";

interface TodosRepositoryDependencies {
  storage?: Storage;
  now?: () => Date;
  createId?: () => string;
}

const createMigratedTodo = (
  id: string,
  name: string,
  url: string,
  timestamp: string,
): TodoItem => {
  const prefix = "迁移的应用：";
  return {
    id,
    title: `${prefix}${name.slice(0, 120 - prefix.length)}`,
    notes: `旧名称：${name}\n旧入口：${url}`,
    completed: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
  };
};

export const createTodosRepository = (
  dependencies: TodosRepositoryDependencies = {},
) => {
  const createId = dependencies.createId ?? (() => crypto.randomUUID());
  const now = dependencies.now ?? (() => new Date());

  return new BrowserLocalDataRepository<TodoPayload>({
    appId: APP_CONFIG.appId,
    schemaVersion: APP_CONFIG.schemaVersion,
    storageKey: APP_CONFIG.storageKey,
    payloadSchema: todoPayloadSchema,
    createDefaultPayload: () => ({ todos: [] }),
    storage: dependencies.storage,
    now,
    createId,
    migrations: {
      1: (payload) => {
        const previous = versionOnePayloadSchema.safeParse(payload);
        if (!previous.success) {
          throw new AppError(
            "DATA_MIGRATION_FAILED",
            "旧版应用导航数据无法迁移为待办列表，原数据已保留。",
            previous.error,
          );
        }
        const timestamp = now().toISOString();
        return {
          todos: previous.data.apps.map((app) =>
            createMigratedTodo(app.id, app.name, app.url, timestamp),
          ),
        };
      },
    },
    legacy: {
      key: LEGACY_STORAGE_KEY,
      parse: (raw) => {
        let candidate: unknown;
        try {
          candidate = JSON.parse(raw) as unknown;
        } catch (error) {
          throw new AppError(
            "DATA_MIGRATION_FAILED",
            "旧版应用数据不是有效的 JSON，原数据已保留。",
            error,
          );
        }
        const parsed = legacyAppsSchema.safeParse(candidate);
        if (!parsed.success) {
          throw new AppError(
            "DATA_MIGRATION_FAILED",
            "旧版应用数据格式不正确，原数据已保留。",
            parsed.error,
          );
        }
        const timestamp = now().toISOString();
        return {
          todos: parsed.data.map((app) =>
            createMigratedTodo(createId(), app.name, app.url, timestamp),
          ),
        };
      },
    },
  });
};
