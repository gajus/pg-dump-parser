# pg-dump-parser

Parses PostgreSQL dump files into an array of schema objects.

## Motivation

The idea behind `pg-dump-parser` is to split the dump file into a series of files. Each file is a top-level schema object (e.g. a table, view, etc.). The same file will contain all the schema objects associated with the top-level object (e.g. comments, indexes, etc.). This makes having the database schema as a reference easier and allows for better checking into version control.

The desired end result is something like this (see [recipes](#recipes) for a script that does this):

```
generated-schema
├── extensions
│  ├── citext.sql
│  └── vector.sql
├── functions
│   ├── public.add_two_numbers.sql
│   └── public.notify_foo_insert.sql
├── materialized-views
│   ├── public.project_total_earnings.sql
│   └── public.user_account_total_earnings.sql
├── tables
│   ├── public.accounting_platform_account.sql
│   └── public.workspace_workspace_group_history.sql
└── types
    ├── public.accounting_platform.sql
    └── public.workspace_type.sql
```

where each file contains the SQL for the schema object.

## Usage

```ts
import { readFile } from 'node:fs/promises';
import { parsePgDump } from 'pg-dump-parser';

const dump = await readFile('dump.sql', 'utf8');

const schemaObjects = parsePgDump(dump);

for (const schemaObject of schemaObjects) {
  console.log(schemaObject);
}
```

> [!NOTE]
> The expected input is a PostgreSQL dump file created with `pg_dump --schema-only`.

The output is an array of objects, each representing a schema object in the dump file and the corresponding header, e.g.,

```json
[
  {
    "header": {
        "Name": "bar",
        "Owner": "postgres",
        "Schema": "public",
        "Type": "TABLE"
    },
    "sql": "CREATE TABLE public.bar (\n    id integer NOT NULL,\n    uid text NOT NULL,\n    foo_id integer\n);"
  },
  {
    "header": {
        "Name": "bar",
        "Owner": "postgres",
        "Schema": "public",
        "Type": "TABLE"
    },
    "sql": "ALTER TABLE public.bar OWNER TO postgres;"
  },
  {
    "header": {
        "Name": "bar_id_seq",
        "Owner": "postgres",
        "Schema": "public",
        "Type": "SEQUENCE"
    },
    "sql": "ALTER TABLE public.bar ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (\n    SEQUENCE NAME public.bar_id_seq\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1\n);"
  }
]
```

### Grouping schema objects

`groupSchemaObjects` is an opinionated utility that assigns object to a scope.

```ts
import { readFile } from 'node:fs/promises';
import { groupSchemaObjects } from 'pg-dump-parser';

const dump = await readFile('dump.sql', 'utf8');

const schemaObjects = parsePgDump(dump);

const schemaObjectScope = groupSchemaObjects(schemaObjects);
  schemaObjects,
  {
    header: {
      Name: 'TABLE foo',
      Owner: 'postgres',
      Schema: 'public',
      Type: 'COMMENT',
    },
    sql: multiline`
      COMMENT ON TABLE public.foo IS 'Table comment x';
    `,
  }
);
```

`schemaObjectScope` is now an object that describes the owner of the object, e.g.,

```ts
{
  name: 'foo',
  schema: 'public',
  type: 'TABLE',
}
```

> [!WARNING]
> The implementation behind `groupSchemaObjects` is _super_ scrappy. It relies on a lot of pattern matching. Use at your own risk.

## Recipes

I intentionally did not include a script for producing a diff, because a lot of it (how you dump the schema, how you group the schema objects, etc.) is subjective. However, this is a version that we are using in production.

```ts
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  parsePgDump,
  SchemaObjectScope,
  scopeSchemaObject,
} from 'pg-dump-parser';
import { default as yargs } from 'yargs';
import { $ } from 'zx';

const formatFileName = (schemaObjectScope: SchemaObjectScope) => {
  const name = schemaObjectScope.name.startsWith('"')
    ? schemaObjectScope.name.slice(1, -1)
    : schemaObjectScope.name;

  if (schemaObjectScope.schema) {
    return `${schemaObjectScope.schema}.${name}.sql`;
  }

  return `${name}.sql`;
};

const argv = await yargs(process.argv.slice(2))
  .env('CDA')
  .options({
    'output-path': {
      demand: true,
      type: 'string',
    },
    'postgres-dsn': {
      demand: true,
      type: 'string',
    },
  })
  .strict()
  .parse();

const dump = await $`pg_dump --schema-only ${argv['postgres-dsn']}`;

const schemaObjects = parsePgDump(dump.stdout);

try {
  await fs.rmdir(argv['output-path'], {
    recursive: true,
  });
} catch {
  // ignore
}

await fs.mkdir(argv['output-path']);

const files: Record<string, string[]> = {};

for (const schemaObject of schemaObjects) {
  const schemaObjectScope = scopeSchemaObject(schemaObjects, schemaObject);

  if (!schemaObjectScope) {
    continue;
  }

  const file = path.join(
    argv['output-path'],
    // MATERIALIZED VIEW => materialized-views
    schemaObjectScope.type.toLowerCase().replace(' ', '-') + 's',
    formatFileName(schemaObjectScope),
  );

  files[file] ??= [];
  files[file].push(schemaObject.sql);
}

for (const [filePath, content] of Object.entries(files)) {
  const directory = path.dirname(filePath);

  await fs.mkdir(directory, { recursive: true });

  await fs.appendFile(filePath, content.join('\n\n') + '\n');
}
```

## Alternatives

* https://github.com/omniti-labs/pg_extractor
  * Prior to writing pg-dump-parser, I used this tool to extract the schema. It works well, but it's slow. It was taking a whole minute to parse our dump file. We needed something that implements equivalent functionality, but is faster. `pg-dump-parser` processes the same dump with in a few seconds.