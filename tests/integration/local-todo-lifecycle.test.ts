import { describe, expect, it } from "vitest";
import { createTodosRepository } from "../../src/features/todos/repository/todos-repository";
import { MemoryStorage } from "../helpers/memory-storage";

describe("本地待办数据生命周期", () => {
  it("创建、完成、刷新、导出、清空并恢复", () => {
    const storage = new MemoryStorage();
    let nowIndex = 0;
    const dependencies = {
      storage,
      createId: () => "device-1",
      now: () => new Date(`2026-07-17T08:00:0${Math.min(nowIndex++, 9)}.000Z`),
    };
    const repository = createTodosRepository(dependencies);
    repository.update((payload) => ({
      todos: [
        {
          id: "todo-1",
          title: "验证 Todo 种子",
          notes: "覆盖本地生命周期",
          completed: false,
          createdAt: "2026-07-17T08:00:00.000Z",
          updatedAt: "2026-07-17T08:00:00.000Z",
          completedAt: null,
        },
        ...payload.todos,
      ],
    }));
    repository.update((payload) => ({
      todos: payload.todos.map((todo) => ({
        ...todo,
        completed: true,
        updatedAt: "2026-07-17T08:00:02.000Z",
        completedAt: "2026-07-17T08:00:02.000Z",
      })),
    }));

    const refreshed = createTodosRepository(dependencies);
    expect(refreshed.load().payload.todos[0]).toMatchObject({
      title: "验证 Todo 种子",
      completed: true,
    });

    const exported = refreshed.exportJson();
    expect(refreshed.reset().payload.todos).toEqual([]);

    const restored = refreshed.importJson(exported);
    expect(restored.payload.todos[0]?.title).toBe("验证 Todo 种子");
    expect(restored.sync.dirty).toBe(true);
    expect(refreshed.getLatestBackupJson()).not.toBeNull();
  });
});
