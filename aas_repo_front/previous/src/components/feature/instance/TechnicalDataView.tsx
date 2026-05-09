"use client";
import React from "react";
import { Table, Text, Tooltip } from "@mantine/core";
import _ from "lodash";

interface TechnicalDataViewProps {
  elements: any[];
  metadata: any;
  level?: number;
}

const getDisplayValue = (element: any, metadata: any): React.ReactNode => {
  const elementData = _.get(metadata, element.valuePath);
  if (!elementData) return "N/A";

  switch (elementData.modelType) {
    case "Property":
      return String(elementData.value ?? "");
    case "MultiLanguageProperty":
      return Array.isArray(elementData.value)
        ? elementData.value.map((v: any) => `[${v.language}] ${v.text}`).join(", ")
        : String(elementData.value ?? "");
    case "File":
      return typeof elementData.value === "string"
        ? elementData.value.split("/").pop()
        : String(elementData.value ?? "");
    case "Range":
      return `Min: ${elementData.min}, Max: ${elementData.max}`;
    case "ReferenceElement":
      return elementData.value?.keys?.[0]?.value || "N/A";
    default:
      return ""; // SMC, SML 등은 값을 직접 표시하지 않음
  }
};

const renderRows = (elements: any[], metadata: any, level = 0): React.ReactNode[] => {
  return elements.flatMap((element, index) => {
    const displayValue = getDisplayValue(element, metadata);
    const description = _.get(metadata, `${element.valuePath}.description`, [])
      .map((d: any) => d.text)
      .join(", ");
    const hasChildren = ["SubmodelElementCollection", "SubmodelElementList"].includes(element.modelType) && element.children && element.children.length > 0;

    const row = (
      <Table.Tr key={element.valuePath || `${element.idShort}-${index}`}>
        <Table.Td style={{ paddingLeft: `${level * 20 + 12}px` }}>
          <Tooltip label={description} disabled={!description} withArrow>
            <Text fw={hasChildren ? 700 : 500}>{element.idShort}</Text>
          </Tooltip>
        </Table.Td>
        <Table.Td>
          <Text c="dimmed" size="sm">
            {displayValue}
          </Text>
        </Table.Td>
      </Table.Tr>
    );

    if (hasChildren) {
      return [row, ...renderRows(element.children, metadata, level + 1)];
    }

    return [row];
  });
};

const TechnicalDataView: React.FC<TechnicalDataViewProps> = ({ elements, metadata }) => {
  return (
    <Table verticalSpacing="xs" striped highlightOnHover withTableBorder withColumnBorders>
      <Table.Thead>
        <Table.Tr>
          <Table.Th style={{ fontSize: '1.1rem', color: '#1f76e5' }}>
            Element
          </Table.Th>
          <Table.Th style={{ fontSize: '1.1rem', color: '#1f76e5' }}>
            Value
          </Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>{renderRows(elements, metadata)}</Table.Tbody>
    </Table>
  );
};

export default TechnicalDataView;