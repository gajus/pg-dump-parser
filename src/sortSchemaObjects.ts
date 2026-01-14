import { type AttributedHeader, type SchemaObject } from './parsePgDump';
import { scopeSchemaObject } from './scopeSchemaObject';

/**
 * Sort order for different schema object types
 */
const TYPE_SORT_ORDER: Record<string, number> = {
  // ACLs and other
  ACL: 18,

  AGGREGATE: 6,
  CAST: 22,

  // Comments
  COMMENT: 17,
  // Constraints (sorted by type)
  CONSTRAINT: 11,
  // Table modifications and defaults
  DEFAULT: 10,

  'DEFAULT ACL': 19,
  // Extensions first
  EXTENSION: 1,
  'FK CONSTRAINT': 12,

  // Functions and procedures
  FUNCTION: 4,

  // Indexes
  INDEX: 13,
  'MATERIALIZED VIEW': 15,

  PROCEDURE: 5,

  // Publications and casts
  PUBLICATION: 21,
  // Types and schemas
  SCHEMA: 2,

  SEQUENCE: 8,

  'SEQUENCE OWNED BY': 9,

  // Tables and sequences
  TABLE: 7,
  // Table attachments
  'TABLE ATTACH': 20,

  'TEXT SEARCH CONFIGURATION': 24,

  // Text search
  'TEXT SEARCH DICTIONARY': 23,
  // Triggers
  TRIGGER: 16,

  TYPE: 3,
  // Views
  VIEW: 14,
};

/**
 * Get the sort key for a constraint based on its type
 */
const getConstraintSortKey = (sql: string): string => {
  const upperSql = sql.toUpperCase();

  if (upperSql.includes('PRIMARY KEY')) {
    return '1_PRIMARY';
  } else if (upperSql.includes('UNIQUE')) {
    return '2_UNIQUE';
  } else if (upperSql.includes('FOREIGN KEY')) {
    return '3_FOREIGN';
  } else if (upperSql.includes('CHECK')) {
    return '4_CHECK';
  } else if (upperSql.includes('EXCLUDE')) {
    return '5_EXCLUDE';
  }

  return '9_OTHER';
};

/**
 * Compare two schema objects for sorting
 */
const compareSchemaObjects = (
  a: SchemaObject,
  b: SchemaObject,
  schemaObjects: SchemaObject[],
): number => {
  // Handle non-attributed headers (like database dump headers)
  if (!('Type' in a.header) && !('Type' in b.header)) {
    return 0;
  }

  if (!('Type' in a.header)) {
    return -1;
  }

  if (!('Type' in b.header)) {
    return 1;
  }

  const aHeader = a.header as AttributedHeader;
  const bHeader = b.header as AttributedHeader;

  // First, sort by type order
  const aTypeOrder = TYPE_SORT_ORDER[aHeader.Type] ?? 999;
  const bTypeOrder = TYPE_SORT_ORDER[bHeader.Type] ?? 999;

  if (aTypeOrder !== bTypeOrder) {
    return aTypeOrder - bTypeOrder;
  }

  // For the same type, apply specific sorting rules

  // Sort by schema first (null schemas come first)
  const aSchema = aHeader.Schema ?? '';
  const bSchema = bHeader.Schema ?? '';
  if (aSchema !== bSchema) {
    if (aSchema === '') {
      return -1;
    }

    if (bSchema === '') {
      return 1;
    }

    return aSchema.localeCompare(bSchema);
  }

  // Special handling for constraints
  if (aHeader.Type === 'CONSTRAINT' || aHeader.Type === 'FK CONSTRAINT') {
    // Extract table name from constraint name (format: "table constraint_name")
    const aTableName = aHeader.Name.split(' ')[0];
    const bTableName = bHeader.Name.split(' ')[0];

    if (aTableName !== bTableName) {
      return aTableName.localeCompare(bTableName);
    }

    // Within the same table, sort by constraint type
    const aConstraintKey = getConstraintSortKey(a.sql);
    const bConstraintKey = getConstraintSortKey(b.sql);

    if (aConstraintKey !== bConstraintKey) {
      return aConstraintKey.localeCompare(bConstraintKey);
    }
  }

  // Special handling for indexes
  if (aHeader.Type === 'INDEX') {
    // Group indexes by their target table
    const aScopeObject = scopeSchemaObject(schemaObjects, a);
    const bScopeObject = scopeSchemaObject(schemaObjects, b);

    if (aScopeObject && bScopeObject) {
      const aTableName = aScopeObject.name;
      const bTableName = bScopeObject.name;

      if (aTableName !== bTableName) {
        return aTableName.localeCompare(bTableName);
      }
    }
  }

  // Special handling for comments - sort by what they comment on
  if (aHeader.Type === 'COMMENT') {
    const aTarget = aHeader.Name;
    const bTarget = bHeader.Name;

    // Extract the type of comment (TABLE, COLUMN, etc.)
    const aCommentType = aTarget.split(' ')[0];
    const bCommentType = bTarget.split(' ')[0];

    if (aCommentType !== bCommentType) {
      // Define order for comment types
      const commentTypeOrder: Record<string, number> = {
        AGGREGATE: 6,
        COLUMN: 8,
        EXTENSION: 1,
        FUNCTION: 4,
        INDEX: 10,
        MATERIALIZED: 12,
        PROCEDURE: 5,
        SCHEMA: 2,
        SEQUENCE: 9,
        TABLE: 7,
        TYPE: 3,
        VIEW: 11,
      };

      const aOrder = commentTypeOrder[aCommentType] ?? 999;
      const bOrder = commentTypeOrder[bCommentType] ?? 999;

      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
    }

    // For COLUMN comments, sort by table name then column position
    if (aCommentType === 'COLUMN') {
      const aMatch = aTarget.match(/COLUMN\s+(\S+\.\S+)\.(.+)/u);
      const bMatch = bTarget.match(/COLUMN\s+(\S+\.\S+)\.(.+)/u);

      if (aMatch && bMatch) {
        const aTable = aMatch[1];
        const bTable = bMatch[1];

        if (aTable !== bTable) {
          return aTable.localeCompare(bTable);
        }

        // Same table, sort by column name
        const aColumn = aMatch[2];
        const bColumn = bMatch[2];

        return aColumn.localeCompare(bColumn);
      }
    }
  }

  // Finally, sort by name
  return aHeader.Name.localeCompare(bHeader.Name);
};

/**
 * Groups schema objects by their scope (table, view, etc.) and sorts them
 */
export const groupAndSortSchemaObjects = (
  schemaObjects: SchemaObject[],
): Map<string, SchemaObject[]> => {
  const grouped = new Map<string, SchemaObject[]>();

  // First, group objects by their scope
  for (const schemaObject of schemaObjects) {
    const scope = scopeSchemaObject(schemaObjects, schemaObject);

    let key: string;
    if (scope) {
      // Create a unique key for each scope
      key = `${scope.type}:${scope.schema ?? 'null'}:${scope.name}`;
    } else if ('Type' in schemaObject.header) {
      // For objects without a scope, group by type
      const header = schemaObject.header as AttributedHeader;
      key = `_UNSCOPED:${header.Type}:${header.Schema ?? 'null'}:${header.Name}`;
    } else {
      // Title headers
      key = '_TITLE';
    }

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    const groupArray = grouped.get(key);
    if (groupArray) {
      groupArray.push(schemaObject);
    }
  }

  // Sort objects within each group
  for (const objects of grouped.values()) {
    objects.sort((a, b) => compareSchemaObjects(a, b, schemaObjects));
  }

  // Sort the groups themselves
  const sortedGrouped = new Map(
    // eslint-disable-next-line unicorn/no-array-sort
    [...grouped.entries()].sort(([keyA], [keyB]) => {
      // Title headers first
      if (keyA === '_TITLE') {
        return -1;
      }

      if (keyB === '_TITLE') {
        return 1;
      }

      // Then unscoped objects
      if (keyA.startsWith('_UNSCOPED:') && !keyB.startsWith('_UNSCOPED:')) {
        return -1;
      }

      if (!keyA.startsWith('_UNSCOPED:') && keyB.startsWith('_UNSCOPED:')) {
        return 1;
      }

      // Sort by type, schema, then name
      return keyA.localeCompare(keyB);
    }),
  );

  return sortedGrouped;
};

/**
 * Sorts an array of schema objects
 */
export const sortSchemaObjects = (
  schemaObjects: SchemaObject[],
): SchemaObject[] => {
  const sorted = [...schemaObjects];

  sorted.sort((a, b) => compareSchemaObjects(a, b, schemaObjects));

  return sorted;
};

/**
 * Sorts schema objects while preserving their grouping by scope
 */
export const sortSchemaObjectsByScope = (
  schemaObjects: SchemaObject[],
): SchemaObject[] => {
  const grouped = groupAndSortSchemaObjects(schemaObjects);
  const result: SchemaObject[] = [];

  for (const objects of grouped.values()) {
    result.push(...objects);
  }

  return result;
};
