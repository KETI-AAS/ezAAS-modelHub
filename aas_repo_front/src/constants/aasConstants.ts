/**
 * AAS 3.0 / 3.1 Standard Constants
 * Reference: https://admin-shell.io/aas/3/1/
 */

export type DataTypeInputKind =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime-local'
  | 'month'
  | 'time';

export type DataTypeDefXsdDefinition = {
  value: string;
  showInOptions: boolean;
  inputKind: DataTypeInputKind;
  step?: number | 'any';
};

// https://admin-shell.io/aas/3/1/DataTypeDefXsd
export const DataTypeDefXsds: readonly DataTypeDefXsdDefinition[] = [
  { value: 'xs:anyURI', showInOptions: true, inputKind: 'text' },
  { value: 'xs:base64Binary', showInOptions: true, inputKind: 'text' },
  { value: 'xs:boolean', showInOptions: true, inputKind: 'boolean' },
  { value: 'xs:byte', showInOptions: false, inputKind: 'number', step: 1 },
  { value: 'xs:date', showInOptions: true, inputKind: 'date' },
  { value: 'xs:dateTime', showInOptions: true, inputKind: 'datetime-local' },
  { value: 'xs:decimal', showInOptions: true, inputKind: 'number', step: 'any' },
  { value: 'xs:double', showInOptions: true, inputKind: 'number', step: 'any' },
  { value: 'xs:duration', showInOptions: true, inputKind: 'text' },
  { value: 'xs:float', showInOptions: true, inputKind: 'number', step: 'any' },
  { value: 'xs:gDay', showInOptions: false, inputKind: 'text' },
  { value: 'xs:gMonth', showInOptions: false, inputKind: 'text' },
  { value: 'xs:gMonthDay', showInOptions: false, inputKind: 'text' },
  { value: 'xs:gYear', showInOptions: false, inputKind: 'number' },
  { value: 'xs:gYearMonth', showInOptions: false, inputKind: 'text' },
  { value: 'xs:hexBinary', showInOptions: false, inputKind: 'text' },
  { value: 'xs:int', showInOptions: false, inputKind: 'number', step: 1 },
  { value: 'xs:integer', showInOptions: true, inputKind: 'number', step: 1 },
  { value: 'xs:long', showInOptions: true, inputKind: 'number', step: 1 },
  { value: 'xs:negativeInteger', showInOptions: false, inputKind: 'number', step: 1 },
  { value: 'xs:nonNegativeInteger', showInOptions: false, inputKind: 'number', step: 1 },
  { value: 'xs:nonPositiveInteger', showInOptions: false, inputKind: 'number', step: 1 },
  { value: 'xs:positiveInteger', showInOptions: false, inputKind: 'number', step: 1 },
  { value: 'xs:short', showInOptions: false, inputKind: 'number', step: 1 },
  { value: 'xs:string', showInOptions: true, inputKind: 'text' },
  { value: 'xs:time', showInOptions: false, inputKind: 'text', step: 1 },
  { value: 'xs:unsignedByte', showInOptions: false, inputKind: 'number', step: 1 },
  { value: 'xs:unsignedInt', showInOptions: false, inputKind: 'number', step: 1 },
  { value: 'xs:unsignedLong', showInOptions: false, inputKind: 'number', step: 1 },
  { value: 'xs:unsignedShort', showInOptions: false, inputKind: 'number', step: 1 },
] as const;

export const DataTypeDefXsdValues = DataTypeDefXsds.map((item) => item.value);

export const DataTypeDefXsdOptionItems = DataTypeDefXsds
  .filter((item) => item.showInOptions)
  .map(item => ({ value: item.value, label: item.value }));

export const getDataTypeDefXsdRule = (dataType?: string | null) =>
  dataType ? DataTypeDefXsds.find((item) => item.value === dataType) : undefined;

// https://admin-shell.io/aas/3/1/EntityType
export const EntityTypes = [
  'CoManagedEntity',
  'SelfManagedEntity'
];

// https://admin-shell.io/aas/3/1/AasSubmodelElements
export const AasSubmodelElements = [
  // 'AnnotatedRelationshipElement',
  // 'BasicEventElement',
  // 'Blob',
  // 'Capability',
  // 'DataElement',
  // 'SubmodelElement',
  // 'Operation',
  'SubmodelElementCollection',
  'SubmodelElementList',
  'Property',
  'MultiLanguageProperty',
  'File',
  'Range',
  'Entity',
  'ReferenceElement',
  'RelationshipElement',
];

// https://admin-shell.io/aas/3/1/ReferenceTypes
export const ReferenceTypes = [
  'ExternalReference',
  'ModelReference'
];

// https://admin-shell.io/aas/3/1/KeyTypes
export const KeyTypes = [
  "AnnotatedRelationshipElement",
  "AssetAdministrationShell",
  "BasicEventElement",
  "Blob",
  "Capability",
  "ConceptDescription",
  "DataElement",
  "Entity",
  "EventElement",
  "File",
  "FragmentReference",
  "GlobalReference",
  "Identifiable",
  "MultiLanguageProperty",
  "Operation",
  "Property",
  "Range",
  "Referable",
  "ReferenceElement",
  "RelationshipElement",
  "Submodel",
  "SubmodelElement",
  "SubmodelElementCollection",
  "SubmodelElementList"
];
