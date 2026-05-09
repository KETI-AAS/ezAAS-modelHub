import React from "react";
import { Tabs, Text, Badge, Flex, Card, Grid, Image, Button, Group } from "@mantine/core";
import _ from "lodash";

interface HandoverDocumentationViewProps {
  submodelNode: any;
  aasmodelMetadata: any;
}

const HandoverDocumentationView: React.FC<HandoverDocumentationViewProps> = ({
  submodelNode,
  aasmodelMetadata,
}) => {
  const smlChildren = submodelNode.children?.filter(
    (child: any) => child.modelType === "SubmodelElementList"
  );

  if (!smlChildren || smlChildren.length === 0) {
    return <Text>No SubmodelElementLists found in HandoverDocumentation.</Text>;
  }

  const getDocInfo = (docVersionElement: any) => {
    const getProp = (idShort: string) => {
      const prop = docVersionElement.children?.find((c: any) => c.idShort === idShort);
      if (!prop) return null;
      return _.get(aasmodelMetadata, prop.valuePath);
    };

    const findPropertyValues = (elements: any[], idShort: string): string[] => {
      let values: string[] = [];
      if (!Array.isArray(elements)) return values;
      for (const element of elements) {
        if (element.idShort === idShort) {
          const propData = _.get(aasmodelMetadata, element.valuePath, element);
          if (propData?.value) {
            if (propData.modelType === 'Property') {
              values.push(String(propData.value));
            } else if (propData.modelType === 'MultiLanguageProperty' && Array.isArray(propData.value) && idShort !== 'Language') {
              propData.value.forEach((v: any) => values.push(`[${v.language}] ${v.text}`));
            }
          }
        }
        const children = element.children || (_.get(aasmodelMetadata, `${element.valuePath}.value`) || []);
        if (Array.isArray(children) && children.length > 0) {
          values = values.concat(findPropertyValues(children, idShort));
        }
      }
      return values;
    };

    const findPropertyValue = (elements: any[], idShort: string, isMLP: boolean = false): string | null => {
      for (const element of elements) {
        if (element.idShort === idShort) {
          const propData = _.get(aasmodelMetadata, element.valuePath);
          if (!propData) return null;

          if (isMLP && propData.modelType === 'MultiLanguageProperty' && Array.isArray(propData.value)) {
            // MLP의 경우, 첫 번째 언어의 텍스트를 반환하거나, 영어가 있으면 영어를 우선 반환합니다.
            const enValue = propData.value.find((v: any) => v.language === 'en');
            return enValue?.text || propData.value[0]?.text || null;
          }

          if (!isMLP && propData.modelType === 'Property') {
            return propData.value ?? null;
          }
        }

        if (element.children && element.children.length > 0) {
          const found = findPropertyValue(element.children, idShort, isMLP);
          if (found) return found;
        }
      }
      return null;
    };
    
    const previewFile = getProp("PreviewFile");
    const digitalFile = getProp("DigitalFile");

    return {
      title: findPropertyValue(docVersionElement.children || [], "Title", true),
      version: findPropertyValue(docVersionElement.children || [], "Version", false),
      // Language는 여러 개일 수 있으므로 모든 값을 찾아 join합니다.
      language: findPropertyValues(docVersionElement.children || [], "Language").join(', '),
      documentIdentifier: findPropertyValue(docVersionElement.children || [], "DocumentIdentifier", false),
      className: findPropertyValue(docVersionElement.children || [], "ClassName", true),
      statusValue: findPropertyValue(docVersionElement.children || [], "StatusValue", false),
      previewUrl: previewFile?.value,
      digitalFileUrl: digitalFile?.value,
      digitalFileName: typeof digitalFile?.value === 'string' ? digitalFile.value.split('/').pop() : 'Download',
    };
  };

  return (
    <Tabs defaultValue={smlChildren[0].idShort}>
      <Tabs.List>
        {smlChildren.map((sml: any) => (
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

      {smlChildren.map((sml: any) => (
        <Tabs.Panel key={sml.idShort} value={sml.idShort} pt="xs">
          <Grid>
            {(sml.children || []).map((docVersion: any, index: number) => {
              const docInfo = getDocInfo(docVersion);
              return (
                <Grid.Col span={{ base: 12, md: 6, lg: 4 }} key={`${docVersion.idShort}-${index}`}>
                  <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Card.Section bg="gray.1">
                      <Image
                        src={docInfo.previewUrl || '/assets/media/svg/files/doc.svg'}
                        height={100}
                        alt={docVersion.idShort}
                        fit="contain" // 이미지가 잘리지 않고 전체가 보이도록 fit 속성 추가
                        fallbackSrc="/assets/media/svg/files/doc.svg"
                      />
                    </Card.Section>

                    <Group justify="space-between" mt="md" mb="xs">
                      <Text fw={500} size="lg" truncate="end">{docInfo.title || docVersion.idShort}</Text>
                      {docInfo.statusValue && <Badge color="pink">{docInfo.statusValue}</Badge>}
                    </Group>

                    <Text size="sm" c="dimmed">Version: {docInfo.version || 'N/A'}</Text>
                    {/* <Text size="sm" c="dimmed">Language: {docInfo.language || 'N/A'}</Text> */}
                    <Text size="sm" c="dimmed">Type: {docInfo.className || 'N/A'}</Text>
                    <Text size="sm" c="dimmed">Status: {docInfo.statusValue || 'N/A'}</Text>
                    <Text size="sm" c="dimmed" truncate="end">Document Identifier: {docInfo.documentIdentifier || 'N/A'}</Text>

                    {docInfo.digitalFileUrl && (
                      <Button
                        component="a"
                        href={docInfo.digitalFileUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="light" color="blue" fullWidth mt="md" radius="md">
                        Download: {docInfo.digitalFileName}
                      </Button>
                    )}
                  </Card>
                </Grid.Col>
              );
            })}
          </Grid>
        </Tabs.Panel>
      ))}
    </Tabs>
  );
};

export default HandoverDocumentationView;