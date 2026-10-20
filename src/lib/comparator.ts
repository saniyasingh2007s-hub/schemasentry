import Ajv from "ajv";

const ajv = new Ajv({ allErrors: true, strict: false });

export interface Finding {
  id: string;
  title: string;
  severity: "breaking" | "warning";
  field: string;
  explanation: string;
  expected: string;
  observed: string;
  suggestedFix: string;
}

export function compareContracts(expectedSchemaStr: string, observedPayloadStr: string): Finding[] {
  let schema: any;
  let payload: any;

  try {
    schema = JSON.parse(expectedSchemaStr);
  } catch (e) {
    throw new Error("Invalid JSON format in Expected Contract / Schema.");
  }

  try {
    payload = JSON.parse(observedPayloadStr);
  } catch (e) {
    throw new Error("Invalid JSON format in Observed API Response Payload.");
  }

  const validate = ajv.compile(schema);
  const isValid = validate(payload);
  const findings: Finding[] = [];

  // 1. Capture Breaking Errors from Ajv Validation
  if (!isValid && validate.errors) {
    validate.errors.forEach((err, index) => {
      const field = err.instancePath ? err.instancePath.replace(/^\//, "") : "root";
      let title = "Type mismatch";
      let explanation = err.message || "Schema violation detected.";
      let expectedVal = JSON.stringify(err.params);
      let observedVal = "Invalid value";

      if (err.keyword === "type") {
        title = "Type mismatch";
        expectedVal = String(err.params.type);
        observedVal = typeof payload[field] !== "undefined" ? JSON.parse(JSON.stringify(payload[field])) : "undefined";
        explanation = `The field "${field}" should be of type ${expectedVal}, but the observed value is ${typeof payload[field]}.`;
      } else if (err.keyword === "enum") {
        title = "Enum mismatch";
        const allowed = err.params.allowedValues ? err.params.allowedValues.join(", ") : "allowed set";
        expectedVal = allowed;
        observedVal = payload[field];
        explanation = `The value for "${field}" must be one of ${allowed}.`;
      }

      findings.push({
        id: `breaking-${index}`,
        title,
        severity: "breaking",
        field,
        explanation,
        expected: expectedVal,
        observed: String(observedVal),
        suggestedFix: `Update the payload or schema to match expected constraints for "${field}".`
      });
    });
  }

  // 2. Capture Non-Breaking Additive Drift (Extra unannounced fields)
  if (schema.properties && typeof payload === "object" && payload !== null) {
    const definedProperties = Object.keys(schema.properties);
    const observedProperties = Object.keys(payload);

    observedProperties.forEach((prop, index) => {
      if (!definedProperties.includes(prop)) {
        findings.push({
          id: `additive-${index}`,
          title: "Additive field detected",
          severity: "warning",
          field: prop,
          explanation: `The field "${prop}" is present in the response payload but missing from the expected contract schema.`,
          expected: "Not defined in schema",
          observed: JSON.stringify(payload[prop]),
          suggestedFix: `Update your expected schema properties to include "${prop}" if this addition is intentional.`
        });
      }
    });
  }

  return findings;
}