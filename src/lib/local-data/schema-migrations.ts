import { AppError } from "../errors/app-error";

export type SchemaMigration = (previousPayload: unknown) => unknown;

export const migratePayload = (
  payload: unknown,
  fromVersion: number,
  toVersion: number,
  migrations: Readonly<Record<number, SchemaMigration>>,
) => {
  if (fromVersion > toVersion) {
    throw new AppError(
      "DATA_MIGRATION_FAILED",
      `数据版本 ${fromVersion} 高于当前支持的版本 ${toVersion}。请升级应用后重试。`,
    );
  }

  let nextPayload = payload;

  for (let version = fromVersion; version < toVersion; version += 1) {
    const migration = migrations[version];
    if (!migration) {
      throw new AppError(
        "DATA_MIGRATION_FAILED",
        `缺少从数据结构版本 ${version} 到 ${version + 1} 的迁移。`,
      );
    }

    try {
      nextPayload = migration(nextPayload);
    } catch (error) {
      throw new AppError(
        "DATA_MIGRATION_FAILED",
        `数据从结构版本 ${version} 迁移到 ${version + 1} 时失败。`,
        error,
      );
    }
  }

  return nextPayload;
};
