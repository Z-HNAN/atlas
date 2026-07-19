import { describe, expect, it } from "vitest";
import {
  todoDraftSchema,
  todoPayloadSchema,
} from "../../src/features/todos/schemas/todo-schema";

const makeTodo = (overrides: Record<string, unknown> = {}) => ({
  id: "todo-1",
  title: "整理种子项目",
  notes: "",
  completed: false,
  createdAt: "2026-07-17T08:00:00.000Z",
  updatedAt: "2026-07-17T08:00:00.000Z",
  completedAt: null,
  ...overrides,
});

describe("Todo 数据 Schema", () => {
  it("清理草稿首尾空白并限制标题和备注长度", () => {
    expect(
      todoDraftSchema.parse({ title: "  编写测试  ", notes: "  离线场景  " }),
    ).toEqual({ title: "编写测试", notes: "离线场景" });
    expect(todoDraftSchema.safeParse({ title: "", notes: "" }).success).toBe(
      false,
    );
    expect(
      todoDraftSchema.safeParse({ title: "a".repeat(121), notes: "" }).success,
    ).toBe(false);
  });

  it("拒绝重复 ID、矛盾的完成状态和倒序时间", () => {
    expect(
      todoPayloadSchema.safeParse({ todos: [makeTodo(), makeTodo()] }).success,
    ).toBe(false);
    expect(
      todoPayloadSchema.safeParse({
        todos: [makeTodo({ completed: true, completedAt: null })],
      }).success,
    ).toBe(false);
    expect(
      todoPayloadSchema.safeParse({
        todos: [
          makeTodo({
            updatedAt: "2026-07-16T08:00:00.000Z",
          }),
        ],
      }).success,
    ).toBe(false);
  });
});
