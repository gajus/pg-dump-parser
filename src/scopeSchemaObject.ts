import { type AttributedHeader, type SchemaObject } from './parsePgDump';
import { z } from 'zod';

type TableTarget = {
  name: string;
  schema: string;
};

const extractOwnedByTarget = (fragment: string): TableTarget => {
  const { name, schema } =
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
  const { name, schema } =
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
  const { name, schema } =
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

const extractAlterTableTarget = (fragment: string): TableTarget => {
  const { name, schema } =
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

const extractFunctionLikeName = (fragment: string): string => {
  const { name } =
    fragment.match(
      /(?:AGGREGATE|FUNCTION|PROCEDURE)\s+(?:(?<schema>\S+)\.)?(?<name>\w+)\s*\(/u,
    )?.groups ?? {};

  if (!name) {
    throw new Error('Invalid FUNCTION name');
  }

  return name;
};

type CommentOnTarget = {
  target: string;
  type:
    | 'AGGREGATE'
    | 'COLUMN'
    | 'EXTENSION'
    | 'FUNCTION'
    | 'INDEX'
    | 'MATERIALIZED VIEW'
    | 'PROCEDURE'
    | 'SEQUENCE'
    | 'TABLE'
    | 'TRIGGER'
    | 'TYPE'
    | 'VIEW';
};

const extractCommentOnTarget = (fragment: string): CommentOnTarget => {
  const { target, type } =
    fragment.match(
      /COMMENT ON (?<type>AGGREGATE|COLUMN|EXTENSION|FUNCTION|INDEX|MATERIALIZED VIEW|PROCEDURE|SEQUENCE|TABLE|TYPE|VIEW)\s(?<target>.+?) IS/u,
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

const findTableLikeOwner = (
  schemaObjects: AttributedSchemaObject[],
  name: string,
  schema: string,
): null | SchemaObjectScope => {
  const targetSchemaObject = schemaObjects.find((schemaObject) => {
    return (
      ['MATERIALIZED VIEW', 'TABLE', 'VIEW'].includes(
        schemaObject.header.Type,
      ) &&
      schemaObject.header.Name === name &&
      schemaObject.header.Schema === schema
    );
  });

  if (!targetSchemaObject) {
    return null;
  }

  return {
    name,
    schema,
    type: targetSchemaObject.header.Type as
      | 'MATERIALIZED VIEW'
      | 'TABLE'
      | 'VIEW',
  };
};

const scopeComment = (
  schemaObjects: AttributedSchemaObject[],
  subject: AttributedSchemaObject,
): null | SchemaObjectScope => {
  const target = extractCommentOnTarget(subject.sql);

  if (target.type === 'AGGREGATE') {
    return {
      name: extractFunctionLikeName(subject.header.Name),
      schema: subject.header.Schema ?? 'public',
      type: 'AGGREGATE',
    };
  }

  if (target.type === 'EXTENSION') {
    return {
      name: target.target,
      schema: null,
      type: 'EXTENSION',
    };
  }

  if (target.type === 'COLUMN') {
    const [schema, name] = z
      .tuple([z.string(), z.string(), z.string()])
      .parse(target.target.split('.'));

    return findTableLikeOwner(schemaObjects, name, schema);
  }

  if (target.type === 'FUNCTION') {
    return {
      name: extractFunctionLikeName(subject.header.Name),
      schema: subject.header.Schema ?? 'public',
      type: 'FUNCTION',
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
      const indexTarget = extractCreateIndexTarget(indexSchemaObject.sql);

      return findTableLikeOwner(
        schemaObjects,
        indexTarget.name,
        indexTarget.schema,
      );
    }

    const constraintSchemaObject = schemaObjects.find((schemaObject) => {
      if (schemaObject.header.Type !== 'CONSTRAINT') {
        return false;
      }

      return schemaObject.header.Name.split(' ')[1] === indexName;
    });

    if (constraintSchemaObject) {
      const [tableName] = constraintSchemaObject.header.Name.split(' ');

      return findTableLikeOwner(schemaObjects, tableName, schema);
    }
  }

  if (target.type === 'MATERIALIZED VIEW') {
    return {
      name: subject.header.Name.replace('MATERIALIZED VIEW ', ''),
      schema: subject.header.Schema ?? 'public',
      type: 'MATERIALIZED VIEW',
    };
  }

  if (target.type === 'PROCEDURE') {
    return {
      name: extractFunctionLikeName(subject.header.Name),
      schema: subject.header.Schema ?? 'public',
      type: 'PROCEDURE',
    };
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

    const alterTableTarget = extractAlterTableTarget(sequenceSchemaObject.sql);

    return findTableLikeOwner(
      schemaObjects,
      alterTableTarget.name,
      alterTableTarget.schema,
    );
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

  if (target.type === 'VIEW') {
    const [schema, name] = z
      .tuple([z.string(), z.string()])
      .parse(target.target.split('.'));

    return {
      name,
      schema,
      type: 'VIEW',
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

  return null;
};

const scopeAttributedSchemaObject = (
  schemaObjects: AttributedSchemaObject[],
  subject: AttributedSchemaObject,
): null | SchemaObjectScope => {
  if (subject.header.Type === 'AGGREGATE') {
    return {
      name: subject.header.Name.split('(')[0],
      schema: subject.header.Schema ?? 'public',
      type: 'AGGREGATE',
    };
  }

  if (subject.header.Type === 'TRIGGER') {
    return {
      name: subject.header.Name.split(' ')[0],
      schema: subject.header.Schema ?? 'public',
      type: 'TABLE',
    };
  }

  if (subject.header.Type === 'FUNCTION') {
    return {
      name: subject.header.Name.split('(')[0],
      schema: subject.header.Schema ?? 'public',
      type: 'FUNCTION',
    };
  }

  if (subject.header.Type === 'EXTENSION') {
    return {
      name: subject.header.Name,
      schema: null,
      type: 'EXTENSION',
    };
  }

  if (subject.header.Type === 'INDEX') {
    const createIndexTarget = extractCreateIndexTarget(subject.sql);

    return findTableLikeOwner(
      schemaObjects,
      createIndexTarget.name,
      createIndexTarget.schema,
    );
  }

  if (subject.header.Type === 'MATERIALIZED VIEW') {
    return {
      name: subject.header.Name,
      schema: subject.header.Schema ?? 'public',
      type: 'MATERIALIZED VIEW',
    };
  }

  if (subject.header.Type === 'PROCEDURE') {
    return {
      name: subject.header.Name.split('(')[0],
      schema: subject.header.Schema ?? 'public',
      type: 'PROCEDURE',
    };
  }

  if (subject.header.Type === 'SEQUENCE') {
    // Handled by ALTER TABLE
  }

  if (subject.header.Type === 'TABLE') {
    return {
      name: subject.header.Name,
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

  if (subject.header.Type === 'VIEW') {
    return {
      name: subject.header.Name,
      schema: subject.header.Schema ?? 'public',
      type: 'VIEW',
    };
  }

  if (subject.sql.startsWith('ALTER TABLE ')) {
    const target = extractAlterTableTarget(subject.sql);

    return findTableLikeOwner(schemaObjects, target.name, target.schema);
  }

  if (subject.sql.startsWith('COMMENT ON ')) {
    return scopeComment(schemaObjects, subject);
  }

  try {
    const ownedByTarget = extractOwnedByTarget(subject.sql);

    return findTableLikeOwner(
      schemaObjects,
      ownedByTarget.name,
      ownedByTarget.schema,
    );
  } catch {
    // ignore
  }

  try {
    const onTableTarget = extractOnTableTarget(subject.sql);

    return findTableLikeOwner(
      schemaObjects,
      onTableTarget.name,
      onTableTarget.schema,
    );
  } catch {
    // ignore
  }

  return null;
};

export const scopeSchemaObject = (
  schemaObjects: SchemaObject[],
  subject: SchemaObject,
): null | SchemaObjectScope => {
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
