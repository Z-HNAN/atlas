import { z } from "zod";

export const todoTitleSchema = z
  .string()
  .trim()
  .min(1, "请填写待办标题。")
  .max(120, "待办标题不能超过 120 个字符。");

export const todoDraftSchema = z
  .object({
    title: todoTitleSchema,
    notes: z.string().trim().max(500, "备注不能超过 500 个字符。"),
  })
  .strict();

export const todoItemSchema = z
  .object({
    id: z.string().min(1),
    title: todoTitleSchema,
    notes: z.string(),
    completed: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
  })
  .strict()
  .superRefine((todo, context) => {
    if (todo.completed !== Boolean(todo.completedAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "待办完成状态与完成时间不一致。",
        path: ["completedAt"],
      });
    }
    if (Date.parse(todo.updatedAt) < Date.parse(todo.createdAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "待办更新时间不能早于创建时间。",
        path: ["updatedAt"],
      });
    }
  });

export const todoPayloadSchema = z
  .object({
    todos: z.array(todoItemSchema),
  })
  .strict()
  .superRefine(({ todos }, context) => {
    const ids = new Set<string>();
    todos.forEach((todo, index) => {
      if (ids.has(todo.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `待办 ID“${todo.id}”重复。`,
          path: ["todos", index, "id"],
        });
      }
      ids.add(todo.id);
    });
  });

export const legacyAppsSchema = z.array(
  z
    .object({
      name: z.string().trim().min(1),
      url: z.string().trim().url(),
    })
    .strict(),
);

export const versionOnePayloadSchema = z
  .object({
    apps: z.array(
      z
        .object({
          id: z.string().min(1),
          name: z.string().trim().min(1),
          url: z.string().trim().url(),
        })
        .strict(),
    ),
  })
  .strict();
