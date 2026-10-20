import YAML from "yaml";

export function parseOpenApiSchema(input: string): any {
  let parsed: any;

  // Try parsing as JSON first, then YAML
  try {
    parsed = JSON.parse(input);
  } catch {
    try {
      parsed = YAML.parse(input);
    } catch {
      throw new Error("Invalid format. Please enter valid JSON or YAML.");
    }
  }

  // If it's already a standard JSON schema, return it as-is
  if (parsed.type || parsed.properties || parsed.$schema) {
    return parsed;
  }

  // Extract schema from OpenAPI 3.x components/schemas
  if (parsed.components && parsed.components.schemas) {
    const schemaKeys = Object.keys(parsed.components.schemas);
    if (schemaKeys.length > 0) {
      const firstKey = schemaKeys[0];
      return parsed.components.schemas[firstKey];
    }
  }

  // Extract schema from Swagger 2.0 definitions
  if (parsed.definitions) {
    const defKeys = Object.keys(parsed.definitions);
    if (defKeys.length > 0) {
      const firstKey = defKeys[0];
      return parsed.definitions[firstKey];
    }
  }

  return parsed;
}