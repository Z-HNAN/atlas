import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserApiKeyStore } from "../../../lib/api-keys/api-key-store";
import { toAppError } from "../../../lib/errors/app-error";
import { DeepSeekTravelPlannerProvider } from "../providers/deepseek-travel-planner-provider";
import type { TravelPlanInput } from "../types/trips";

export const useTravelPlanner = () => {
  const storeRef = useRef<BrowserApiKeyStore | null>(null);
  storeRef.current ??= new BrowserApiKeyStore();
  const providerRef = useRef<DeepSeekTravelPlannerProvider | null>(null);
  providerRef.current ??= new DeepSeekTravelPlannerProvider();
  const abortRef = useRef<AbortController | null>(null);
  const [hasKey, setHasKey] = useState(() =>
    Boolean(storeRef.current?.get("deepseek")),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const saveKey = useCallback((apiKey: string, remember: boolean) => {
    try {
      if (remember) storeRef.current?.setPersistent("deepseek", apiKey);
      else storeRef.current?.setSession("deepseek", apiKey);
      setHasKey(true);
      setError("");
      return { ok: true as const };
    } catch (caught) {
      const appError = toAppError(caught, "DeepSeek API Key 保存失败。");
      setError(appError.message);
      return { ok: false as const, error: appError.message };
    }
  }, []);

  const clearKey = useCallback(() => {
    try {
      abortRef.current?.abort();
      storeRef.current?.remove("deepseek");
      setHasKey(false);
      setError("");
    } catch (caught) {
      setError(toAppError(caught, "DeepSeek API Key 清除失败。").message);
    }
  }, []);

  const generate = useCallback(async (input: TravelPlanInput) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const value = await providerRef.current!.execute(input, {
        apiKey: storeRef.current?.get("deepseek") ?? undefined,
        signal: controller.signal,
      });
      return { ok: true as const, value };
    } catch (caught) {
      const appError = toAppError(caught, "AI 旅行计划生成失败。");
      setError(appError.message);
      return { ok: false as const, error: appError.message };
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setLoading(false);
    }
  }, []);

  return { hasKey, loading, error, saveKey, clearKey, generate };
};
