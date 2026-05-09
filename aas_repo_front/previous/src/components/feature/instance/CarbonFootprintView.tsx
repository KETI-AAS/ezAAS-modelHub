import React from "react";
import { Tabs, Text, Badge, Flex, Table, Tooltip, Grid, Card, Group } from "@mantine/core";
import _ from "lodash";

interface CarbonFootprintViewProps {
  submodelNode: any;
  aasmodelMetadata: any;
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
      if (typeof elementData.value === 'object' && elementData.value !== null) {
        if ('value' in elementData.value) {
          return String(elementData.value.value ?? "");
        }
        return ""; 
      }
      return String(elementData.value ?? "");
  }
};

const CarbonFootprintView: React.FC<CarbonFootprintViewProps> = ({
  submodelNode,
  aasmodelMetadata,
}) => {
  const smlChildren = submodelNode.children?.filter(
    (child) => child.modelType === "SubmodelElementList"
  );

  if (!smlChildren || smlChildren.length === 0) {
    return <Text>No SubmodelElementLists found in CarbonFootprint.</Text>;
  }

  const pcfValue = smlChildren
    .flatMap((sml) => sml.children || [])
    .reduce((sum, childElement) => {
      const pcfCO2eqElement = childElement.children?.find(
        (el: any) => el.idShort === "PcfCO2eq"
      );
      if (pcfCO2eqElement) {
        const valueStr = _.get(
          aasmodelMetadata,
          `${pcfCO2eqElement.valuePath}.value`,
          "0"
        );
        const value = parseFloat(valueStr) || 0;
        return sum + value;
      }
      return sum;
    }, 0);

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

  return (
    <Tabs defaultValue={smlChildren[0].idShort}>
      <Tabs.List>
        {smlChildren.map((sml) => (
          <Tabs.Tab key={sml.idShort} value={sml.idShort}>
            <Flex align="center" gap="xs">
              <Text>{sml.idShort}</Text>
              {Array.isArray(sml.children) && (
                <Badge color="blue" variant="light">
                  {sml.children.length}
                </Badge>
              )}
            </Flex>
          </Tabs.Tab>
        ))}
      </Tabs.List>

      <Card shadow="sm" padding="lg" radius="md" withBorder mt="md">
        <Group justify="center">
          <Text fw={500}>제품 탄소 발자국 데이터</Text>
          <Text size="lg" fw={700}>
            총합 PcfCO2eq :{" "}
            <Text span c="blue" inherit>
              {pcfValue}
            </Text>
          </Text>
        </Group>
      </Card>

      {smlChildren.map((sml) => (
        <Tabs.Panel key={sml.idShort} value={sml.idShort} pt="xs">
          <Grid>
            {(sml.children || []).map((childElement: any, index: number) => (
              <Grid.Col span={{ base: 12, md: 6, lg: 4 }} key={`${childElement.idShort}-${index}`}>
                <Table verticalSpacing="xs" striped highlightOnHover withTableBorder withColumnBorders>
                  <Table.Thead>
                    {(() => {
                      // 1. LifeCyclePhases 'SubmodelElementList'(폴더)를 찾습니다.
                      const lifeCyclePhaseElement = childElement.children?.find(
                        (el: any) => el.idShort === "LifeCyclePhases"
                      );

                      let title = childElement.idShort; // 기본값 (요소를 못 찾을 경우)

                      // 2. 폴더를 찾았고, 그 안에 자식 요소(파일)가 있는지 확인합니다.
                      if (
                        lifeCyclePhaseElement &&
                        lifeCyclePhaseElement.children &&
                        lifeCyclePhaseElement.children.length > 0
                      ) {
                        // 3. 첫 번째 자식 요소(Prop <no idShort>)를 가져옵니다.
                        const valueElement = lifeCyclePhaseElement.children[0];
                        
                        // 4. 그 자식 요소를 getDisplayValue로 보내 실제 값("A3 - production")을 가져옵니다.
                        title = getDisplayValue(valueElement, aasmodelMetadata);
                      }

                      return (
                        <Table.Tr>
                          <Table.Th colSpan={2} style={{ fontSize: '1.1rem', color: '#1f76e5' }}>
                            {title}
                          </Table.Th>
                        </Table.Tr>
                      );
                    })()}
                    <Table.Tr>
                      <Table.Th>Element</Table.Th>
                      <Table.Th>Value</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {renderRows(childElement.children || [], aasmodelMetadata)}
                  </Table.Tbody>
                </Table>
              </Grid.Col>
            ))}
          </Grid>
        </Tabs.Panel>
      ))}
    </Tabs>
  );
};


export default CarbonFootprintView;