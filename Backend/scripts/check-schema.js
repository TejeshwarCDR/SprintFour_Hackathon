import dotenv from 'dotenv';

dotenv.config();

const REQUIRED_TABLES = {
  documents: [
    'id',
    'original_filename',
    'raw_text',
    'status',
    'uploaded_at',
  ],
  ontology_rules: [
    'id',
    'type',
    'pattern',
    'description',
  ],
  spans: [
    'id',
    'document_id',
    'text',
    'start_offset',
    'end_offset',
    'type',
    'llm_confidence',
    'llm_rationale',
    'ontology_rule_id',
    'source',
    'conflict',
    'risk_tier',
    'priority_score',
    'status',
    'reviewed_at',
    'reviewed_by',
  ],
  audit_entries: [
    'id',
    'span_id',
    'action',
    'actor',
    'timestamp',
    'previous_state',
    'new_state',
  ],
};

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const getOpenApiDocument = async () => {
  const supabaseUrl = requireEnv('SUPABASE_URL').replace(/\/$/, '');
  const serviceKey = requireEnv('SUPABASE_SERVICE_KEY');
  const response = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: 'application/openapi+json',
    },
  });

  if (!response.ok) {
    throw new Error(`Could not fetch Supabase REST OpenAPI schema: ${response.status} ${await response.text()}`);
  }

  return response.json();
};

const getTableSchemas = (openApi) => {
  const schemas = openApi.components?.schemas || openApi.definitions || {};
  const result = {};

  for (const [name, schema] of Object.entries(schemas)) {
    const properties = schema.properties || {};
    result[name] = new Set(Object.keys(properties));
  }

  return result;
};

const main = async () => {
  const openApi = await getOpenApiDocument();
  const tableSchemas = getTableSchemas(openApi);
  const failures = [];

  for (const [tableName, requiredColumns] of Object.entries(REQUIRED_TABLES)) {
    const columns = tableSchemas[tableName];
    if (!columns) {
      failures.push(`${tableName}: table is missing`);
      continue;
    }

    const missingColumns = requiredColumns.filter((column) => !columns.has(column));
    if (missingColumns.length > 0) {
      failures.push(`${tableName}: missing columns ${missingColumns.join(', ')}`);
    }
  }

  if (failures.length > 0) {
    console.error('Schema check failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log('Schema check passed: all required tables and columns are exposed by Supabase REST.');
  for (const tableName of Object.keys(REQUIRED_TABLES)) {
    console.log(`- ${tableName}: ${REQUIRED_TABLES[tableName].length} expected columns present`);
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
