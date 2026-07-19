import type { z } from "zod";
import type {
  todoDraftSchema,
  todoItemSchema,
  todoPayloadSchema,
} from "../schemas/todo-schema";

export type TodoDraft = z.infer<typeof todoDraftSchema>;
export type TodoItem = z.infer<typeof todoItemSchema>;
export type TodoPayload = z.infer<typeof todoPayloadSchema>;
export type TodoFilter = "all" | "active" | "completed";
