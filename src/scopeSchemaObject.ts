import { type AttributedHeader, type SchemaObject } from './parsePgDump';
import { z } from 'zod';

type TableTarget = {
  name: string;
  schema: string;
};

const extractOwnedByTarget = (fragment: string): TableTarget => {
  const { schema, name } =
    fragment.match(/OWNED BY\s(?<schema>[^.]+)\.(?<name>[^.]+)/u)?.groups ?? {};

  if (!schema) {
    throw new Error('Invalid OWNED BY target (missing schema)');
  }

  if (!name) {
    throw new Error('Invalid OWNED BY target (missing name)');
  }

  return {
    name,
    schema,
  };
};

const extractOnTableTarget = (fragment: string): TableTarget => {
  const { schema, name } =
    fragment.match(/ON TABLE\s(?<schema>[^.]+)\.(?<name>\S+)/u)?.groups ?? {};

  if (!schema) {
    throw new Error('Invalid ON TABLE target');
  }

  if (!name) {
    throw new Error('Invalid ON TABLE target');
  }

  return {
    name,
    schema,
  };
};

const extractCreateIndexTarget = (fragment: string): TableTarget => {
  const { schema, name } =
    fragment.match(/ON\s(?<schema>[^.]+)\.(?<name>\S+)/u)?.groups ?? {};

  if (!schema) {
    throw new Error('Invalid CREATE INDEX target');
  }

  if (!name) {
    throw new Error('Invalid CREATE INDEX target');
  }

  return {
    name,
    schema,
  };
};

const extractCreateViewTarget = (fragment: string): TableTarget => {
  const { schema, name } =
    fragment.match(
      /CREATE VIEW (?:IF NOT EXISTS\s)?(?<schema>[^.]+)\.(?<name>\S+)/u,
    )?.groups ?? {};

  if (!schema) {
    throw new Error('Invalid CREATE VIEW target');
  }

  if (!name) {
    throw new Error('Invalid CREATE VIEW target');
  }

  return {
    name,
    schema,
  };
};

const extractCreateTableTarget = (fragment: string): TableTarget => {
  const { schema, name } =
    fragment.match(
      /CREATE TABLE (?:IF NOT EXISTS\s)?(?<schema>[^.]+)\.(?<name>\S+)/u,
    )?.groups ?? {};

  if (!schema) {
    throw new Error('Invalid CREATE TABLE target');
  }

  if (!name) {
    throw new Error('Invalid CREATE TABLE target');
  }

  return {
    name,
    schema,
  };
};

const extractAlterTableTarget = (fragment: string): TableTarget => {
  const { schema, name } =
    fragment.match(/ALTER TABLE (?:ONLY\s)?(?<schema>[^.]+)\.(?<name>\S+)/u)
      ?.groups ?? {};

  if (!schema) {
    throw new Error('Invalid ALTER TABLE target');
  }

  if (!name) {
    throw new Error('Invalid ALTER TABLE target');
  }

  return {
    name,
    schema,
  };
};

type CommentOnTarget = {
  target: string;
  type: 'COLUMN' | 'EXTENSION' | 'INDEX' | 'SEQUENCE' | 'TABLE' | 'TYPE';
};

const extractCommentOnTarget = (fragment: string): CommentOnTarget => {
  const { target, type } =
    fragment.match(
      /COMMENT ON (?<type>TABLE|EXTENSION|COLUMN|SEQUENCE|INDEX|TYPE)\s(?<target>\S+)/u,
    )?.groups ?? {};

  if (!target) {
    throw new Error('Invalid COMMENT ON target (missing target)');
  }

  if (!type) {
    throw new Error('Invalid COMMENT ON target (missing type)');
  }

  return {
    target,
    type: type as CommentOnTarget['type'],
  };
};

export type SchemaObjectScope =
  | {
      name: string;
      schema: null;
      type: 'EXTENSION';
    }
  | {
      name: string;
      schema: string;
      type:
        | 'AGGREGATE'
        | 'FUNCTION'
        | 'MATERIALIZED VIEW'
        | 'PROCEDURE'
        | 'TABLE'
        | 'TYPE'
        | 'VIEW';
    };

type AttributedSchemaObject = {
  header: AttributedHeader;
  sql: string;
};

// eslint-disable-next-line complexity
const scopeAttributedSchemaObject = (
  schemaObjects: AttributedSchemaObject[],
  subject: AttributedSchemaObject,
): SchemaObjectScope | null => {
  if (subject.header.Type === 'FUNCTION') {
    return {
      name: subject.header.Name.split('(')[0],
      schema: subject.header.Schema ?? 'public',
      type: 'FUNCTION',
    };
  }

  if (subject.header.Type === 'PROCEDURE') {
    return {
      name: subject.header.Name.split('(')[0],
      schema: subject.header.Schema ?? 'public',
      type: 'PROCEDURE',
    };
  }

  if (subject.header.Type === 'TRIGGER') {
    return {
      name: subject.header.Name.split(' ')[0],
      schema: subject.header.Schema ?? 'public',
      type: 'TABLE',
    };
  }

  if (subject.header.Type === 'TYPE') {
    return {
      name: subject.header.Name,
      schema: subject.header.Schema ?? 'public',
      type: 'TYPE',
    };
  }

  if (subject.header.Type === 'AGGREGATE') {
    return {
      name: subject.header.Name.split('(')[0],
      schema: subject.header.Schema ?? 'public',
      type: 'AGGREGATE',
    };
  }

  if (subject.header.Type === 'INDEX') {
    const target = extractCreateIndexTarget(subject.sql);

    return {
      name: target.name,
      schema: target.schema,
      type: 'TABLE',
    };
  }

  if (subject.header.Type === 'EXTENSION') {
    return {
      name: subject.header.Name,
      schema: null,
      type: 'EXTENSION',
    };
  }

  if (subject.header.Type === 'MATERIALIZED VIEW') {
    return {
      name: subject.header.Name,
      schema: subject.header.Schema ?? 'public',
      type: 'MATERIALIZED VIEW',
    };
  }

  if (subject.sql.startsWith('CREATE VIEW ')) {
    const target = extractCreateViewTarget(subject.sql);

    return {
      name: target.name,
      schema: target.schema,
      type: 'VIEW',
    };
  }

  if (subject.sql.startsWith('CREATE TABLE ')) {
    const target = extractCreateTableTarget(subject.sql);

    return {
      name: target.name,
      schema: target.schema,
      type: 'TABLE',
    };
  }

  if (subject.sql.startsWith('ALTER TABLE ')) {
    const target = extractAlterTableTarget(subject.sql);

    return {
      name: target.name,
      schema: target.schema,
      type: 'TABLE',
    };
  }

  if (subject.sql.startsWith('COMMENT ON ')) {
    const target = extractCommentOnTarget(subject.sql);

    if (target.type === 'EXTENSION') {
      return {
        name: target.target,
        schema: null,
        type: 'EXTENSION',
      };
    }

    if (target.type === 'TABLE') {
      const [schema, name] = z
        .tuple([z.string(), z.string()])
        .parse(target.target.split('.'));

      return {
        name,
        schema,
        type: 'TABLE',
      };
    }

    if (target.type === 'COLUMN') {
      const [schema, name] = z
        .tuple([z.string(), z.string(), z.string()])
        .parse(target.target.split('.'));

      return {
        name,
        schema,
        type: 'TABLE',
      };
    }

    if (target.type === 'INDEX') {
      const [schema, indexName] = z
        .tuple([z.string(), z.string()])
        .parse(target.target.split('.'));

      const indexSchemaObject = schemaObjects.find((schemaObject) => {
        if (schemaObject.header.Type !== 'INDEX') {
          return false;
        }

        return schemaObject.header.Name === indexName;
      });

      if (indexSchemaObject) {
        throw new Error('Not implemented');
      }

      const constraintSchemaObject = schemaObjects.find((schemaObject) => {
        if (schemaObject.header.Type !== 'CONSTRAINT') {
          return false;
        }

        return schemaObject.header.Name.split(' ')[1] === indexName;
      });

      if (constraintSchemaObject) {
        const [tableName] = constraintSchemaObject.header.Name.split(' ');

        return {
          name: tableName,
          schema,
          type: 'TABLE',
        };
      }
    }

    if (target.type === 'SEQUENCE') {
      const [schemaName, sequenceName] = z
        .tuple([z.string(), z.string()])
        .parse(target.target.split('.'));

      const sequenceSchemaObject = schemaObjects.find((schemaObject) => {
        if (schemaObject.header.Type !== 'SEQUENCE') {
          return false;
        }

        return (
          schemaObject.header.Name === sequenceName &&
          schemaObject.header.Schema === schemaName
        );
      });

      if (!sequenceSchemaObject) {
        throw new Error('Sequence not found');
      }

      const alterTableTarget = extractAlterTableTarget(
        sequenceSchemaObject.sql,
      );

      return {
        name: alterTableTarget.name,
        schema: alterTableTarget.schema,
        type: 'TABLE',
      };
    }

    if (target.type === 'TYPE') {
      const [, typeName] = z
        .tuple([z.string(), z.string()])
        .parse(subject.header.Name.split(' '));

      return {
        name: typeName,
        schema: subject.header.Schema ?? 'public',
        type: 'TYPE',
      };
    }
  }

  try {
    const target = extractOwnedByTarget(subject.sql);

    return {
      name: target.name,
      schema: target.schema,
      type: 'TABLE',
    };
  } catch {
    // ignore
  }

  try {
    const target = extractOnTableTarget(subject.sql);

    return {
      name: target.name,
      schema: target.schema,
      type: 'TABLE',
    };
  } catch {
    // ignore
  }

  return null;
};

export const scopeSchemaObject = (
  schemaObjects: SchemaObject[],
  subject: SchemaObject,
): SchemaObjectScope | null => {
  if (!('Type' in subject.header)) {
    return null;
  }

  const attributedSchemaObjects = schemaObjects.filter(
    (schemaObject) => 'Type' in schemaObject.header,
  ) as AttributedSchemaObject[];

  return scopeAttributedSchemaObject(
    attributedSchemaObjects,
    subject as AttributedSchemaObject,
  );
};
