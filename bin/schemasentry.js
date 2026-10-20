#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");
const Ajv = require("ajv");

const ajv = new Ajv({ allErrors: true, strict: false });

function parseSchema(content) {
  try {
    return JSON.parse(content);
  } catch (e) {
    try {
      const parsed = YAML.parse(content);
      if (parsed.components && parsed.components.schemas) {
        const keys = Object.keys(parsed.components.schemas);
        return parsed.components.schemas[keys[0]];
      }
      return parsed;
    } catch (err) {
      throw new Error("Failed to parse schema as JSON or YAML.");
    }
  }
}

function compareContracts(schemaObj, payloadObj) {
  const validate = ajv.compile(schemaObj);
  const isValid = validate(payloadObj);
  const findings = [];

  if (!isValid && validate.errors) {
    validate.errors.forEach((err, idx) => {
      const field = err.instancePath ? err.instancePath.replace(/^\//, "") : "root";
      findings.push({
        id: `breaking-${idx}`,
        title: "Type / Enum Mismatch",
        severity: "BREAKING",
        field,
        message: err.message
      });
    });
  }

  if (schemaObj.properties && typeof payloadObj === "object" && payloadObj !== null) {
    const definedProps = Object.keys(schemaObj.properties);
    const observedProps = Object.keys(payloadObj);

    observedProps.forEach((prop, idx) => {
      if (!definedProps.includes(prop)) {
        findings.push({
          id: `additive-${idx}`,
          title: "Additive Field Detected",
          severity: "WARNING",
          field: prop,
          message: `Field "${prop}" is missing from expected schema.`
        });
      }
    });
  }

  return findings;
}

// CLI Execution Arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log("\n🛡️ SchemaSentry CLI");
  console.log("Usage: npx schemasentry <schema-file.json|yaml> <payload-file.json>\n");
  process.exit(1);
}

const [schemaPath, payloadPath] = args;

try {
  const schemaRaw = fs.readFileSync(path.resolve(schemaPath), "utf8");
  const payloadRaw = fs.readFileSync(path.resolve(payloadPath), "utf8");

  const schema = parseSchema(schemaRaw);
  const payload = JSON.parse(payloadRaw);

  const findings = compareContracts(schema, payload);

  console.log("\n🛡️ --- SchemaSentry Audit Report ---\n");
  if (findings.length === 0) {
    console.log("✅ No contract drift detected! Payload matches schema perfectly.\n");
    process.exit(0);
  }

  let hasBreaking = false;
  findings.forEach((f) => {
    if (f.severity === "BREAKING") hasBreaking = true;
    const badge = f.severity === "BREAKING" ? "🔴 BREAKING" : "🟡 WARNING";
    console.log(`${badge}: ${f.title}`);
    console.log(`   Field:   ${f.field}`);
    console.log(`   Details: ${f.message}\n`);
  });

  if (hasBreaking) {
    console.log("❌ Audit failed due to breaking contract drift.\n");
    process.exit(1);
  } else {
    console.log("⚠️ Audit passed with warnings.\n");
    process.exit(0);
  }
} catch (error) {
  console.error(`❌ Error running SchemaSentry: ${error.message}`);
  process.exit(1);
}