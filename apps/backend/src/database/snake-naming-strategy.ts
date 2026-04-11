import { DefaultNamingStrategy } from "typeorm";

function toSnakeCase(str: string) {
  return str.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
}

export class SnakeNamingStrategy extends DefaultNamingStrategy {
  tableName(className: string, customName?: string) {
    return customName ?? toSnakeCase(className);
  }

  columnName(propertyName: string, customName?: string, embeddedPrefixes: string[] = []) {
    const name = customName ?? toSnakeCase(propertyName);
    return embeddedPrefixes.length
      ? embeddedPrefixes.map(toSnakeCase).join("_") + "_" + name
      : name;
  }

  relationName(propertyName: string) {
    return toSnakeCase(propertyName);
  }

  joinColumnName(relationName: string, referencedColumnName: string) {
    return toSnakeCase(relationName) + "_" + toSnakeCase(referencedColumnName);
  }

  joinTableName(firstTableName: string, secondTableName: string) {
    return firstTableName + "_" + secondTableName;
  }

  joinTableColumnName(tableName: string, propertyName: string, columnName?: string) {
    return tableName + "_" + (columnName ?? toSnakeCase(propertyName));
  }
}
