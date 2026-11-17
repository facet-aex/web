export type SchemaFieldType =
  "string" | "integer" | "number" | "boolean" | "array";

export interface VisualSchemaField {
  id: string;
  name: string;
  type: SchemaFieldType;
  required: boolean;
  defaultValue: string;
  enumValues: string;
  description: string;
}

export interface SchemaExtractionResult {
  editable: boolean;
  reason?: string;
  fields: VisualSchemaField[];
}

const SUPPORTED_TYPES = new Set<SchemaFieldType>([
  "string",
  "integer",
  "number",
  "boolean",
  "array",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isFlatEditableSchema(schema: unknown): {
  editable: boolean;
  reason?: string;
} {
  if (!isRecord(schema)) {
    return {
      editable: false,
      reason: "Schema must be a JSON object.",
    };
  }
  if (schema.type !== undefined && schema.type !== "object") {
    return {
      editable: false,
      reason: 'Root schema must use "type": "object".',
    };
  }
  if (
    schema.anyOf !== undefined ||
    schema.oneOf !== undefined ||
    schema.allOf !== undefined
  ) {
    return {
      editable: false,
      reason:
        "This schema uses JSON Schema combinators (anyOf/oneOf/allOf). Edit in Raw JSON to preserve constraints.",
    };
  }
  if (schema.properties !== undefined && !isRecord(schema.properties)) {
    return {
      editable: false,
      reason: "Schema properties must be an object.",
    };
  }
  if (isRecord(schema.properties)) {
    for (const [key, rawProp] of Object.entries(schema.properties)) {
      if (!isRecord(rawProp)) {
        return {
          editable: false,
          reason: `Property "${key}" is not a schema object.`,
        };
      }
      const propType = rawProp.type;
      if (
        propType === "object" ||
        isRecord(rawProp.properties) ||
        rawProp.anyOf !== undefined ||
        rawProp.oneOf !== undefined ||
        rawProp.allOf !== undefined
      ) {
        return {
          editable: false,
          reason: `Property "${key}" uses nested objects or combinators. Edit in Raw JSON to preserve structure.`,
        };
      }
      if (
        typeof propType === "string" &&
        !SUPPORTED_TYPES.has(propType as SchemaFieldType)
      ) {
        return {
          editable: false,
          reason: `Property "${key}" uses type "${propType}". Edit in Raw JSON.`,
        };
      }
    }
  }
  return { editable: true };
}

function formatDefaultValue(value: unknown, type: SchemaFieldType): string {
  if (value === undefined) return "";
  if (type === "array") {
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}

export function schemaToVisualFields(schema: unknown): SchemaExtractionResult {
  const flatCheck = isFlatEditableSchema(schema);
  if (!flatCheck.editable || !isRecord(schema)) {
    return {
      editable: false,
      ...(flatCheck.reason ? { reason: flatCheck.reason } : {}),
      fields: [],
    };
  }

  const requiredSet = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
  );
  const properties = isRecord(schema.properties) ? schema.properties : {};

  const fields: VisualSchemaField[] = Object.entries(properties).map(
    ([name, rawProp], index) => {
      const prop = isRecord(rawProp) ? rawProp : {};
      const type: SchemaFieldType =
        typeof prop.type === "string" &&
        SUPPORTED_TYPES.has(prop.type as SchemaFieldType)
          ? (prop.type as SchemaFieldType)
          : "string";
      const enumValues = Array.isArray(prop.enum)
        ? prop.enum.map((item) => String(item)).join(", ")
        : "";
      return {
        id: `field-${index}-${name}`,
        name,
        type,
        required: requiredSet.has(name),
        defaultValue: formatDefaultValue(prop.default, type),
        enumValues,
        description:
          typeof prop.description === "string" ? prop.description : "",
      };
    },
  );

  return { editable: true, fields };
}

function parseTypedLiteral(raw: string, type: SchemaFieldType): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (type === "boolean") {
    if (trimmed.toLowerCase() === "true") return true;
    if (trimmed.toLowerCase() === "false") return false;
    return undefined;
  }
  if (type === "integer") {
    const parsed = Number(trimmed);
    return Number.isInteger(parsed) ? parsed : undefined;
  }
  if (type === "number") {
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (type === "array") {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return raw;
}

export function visualFieldsToSchema(
  fields: VisualSchemaField[],
): Record<string, unknown> {
  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];

  for (const field of fields) {
    const key = field.name.trim();
    if (!key) continue;
    const prop: Record<string, unknown> = { type: field.type };

    if (
      field.enumValues.trim() &&
      (field.type === "string" ||
        field.type === "integer" ||
        field.type === "number")
    ) {
      const parsedEnums = field.enumValues
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) =>
          field.type === "string" ? item : parseTypedLiteral(item, field.type),
        )
        .filter((item) => item !== undefined);
      if (parsedEnums.length > 0) {
        prop.enum = parsedEnums;
      }
    }

    const parsedDefault = parseTypedLiteral(field.defaultValue, field.type);
    if (parsedDefault !== undefined) {
      prop.default = parsedDefault;
    }

    if (field.description.trim()) {
      prop.description = field.description.trim();
    }

    if (field.type === "array") {
      prop.items = { type: "object" };
    }

    properties[key] = prop;
    if (field.required) {
      required.push(key);
    }
  }

  return {
    type: "object",
    ...(required.length > 0 ? { required } : {}),
    properties,
  };
}

export function parseInputSchemaText(text: string): {
  schema: Record<string, unknown> | null;
  error: string | null;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { schema: null, error: "Input schema must be valid JSON." };
  }
  if (!isRecord(parsed)) {
    return { schema: null, error: "Input schema must be a JSON object." };
  }
  return { schema: parsed, error: null };
}
