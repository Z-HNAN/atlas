export interface ExternalApiProvider<TInput, TOutput> {
  id: string;
  execute(
    input: TInput,
    options: {
      apiKey?: string;
      signal?: AbortSignal;
    },
  ): Promise<TOutput>;
}
