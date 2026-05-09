"use client";
import {
  ActionIcon,
  Button,
  Combobox,
  Flex,
  Group,
  Modal,
  TextInput,
  useCombobox,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconPlus } from "@tabler/icons-react";
import { useState } from "react";

const elementTypes = [
  "SubmodelElementCollection",
  "SubmodelElementList",
  "Property",
  "MultiLanguageProperty",
  "Range",
  "File",
  "ReferenceElement",
  "Entity",
  "RelationshipElement",
];

interface ElementAddProps {
  onAdd: (elementType: string, idShort: string) => void;
  allowedTypes?: string[];
}

export default function ElementAdd({
  onAdd,
  allowedTypes = elementTypes,
}: ElementAddProps) {
  const [opened, { open, close }] = useDisclosure(false);
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const [value, setValue] = useState<string | null>(null);
  const [idShort, setIdShort] = useState("");

  const handleAddClick = () => {
    if (value && idShort) {
      onAdd(value, idShort);
      setValue(null);
      setIdShort("");
      close();
    }
  };

  const options = allowedTypes.map((item) => (
    <Combobox.Option value={item} key={item}>
      {item}
    </Combobox.Option>
  ));

  return (
    <>
      <Modal
        opened={opened}
        onClose={close}
        title="Add New Element"
        centered
        onClick={(e) => e.stopPropagation()}>
        <Flex direction="column" gap="md">
          <Combobox
            store={combobox}
            withinPortal={true}
            onOptionSubmit={(val) => {
              setValue(val);
              combobox.closeDropdown();
            }}
          >
            <Combobox.Target>
              <Button
                variant="subtle"
                size="compact-md"
                onClick={() => combobox.toggleDropdown()}
                fullWidth
              >
                {value || "Select Type"}
              </Button>
            </Combobox.Target>

            <Combobox.Dropdown>
              <Combobox.Options>{options}</Combobox.Options>
            </Combobox.Dropdown>
          </Combobox>

          <TextInput
            label="idShort"
            placeholder="Enter idShort"
            value={idShort}
            onChange={(event) => setIdShort(event.currentTarget.value)}
            required
          />
        </Flex>
        <Group justify="flex-end" mt="xl">
          <Button variant="default" onClick={close}>
            Cancel
          </Button>
          <Button onClick={handleAddClick} disabled={!value || !idShort}>
            Add
          </Button>
        </Group>
      </Modal>

      <ActionIcon
        variant="subtle"
        color="gray"
        onClick={open}
      >
        <IconPlus size={16} />
      </ActionIcon>
    </>
  );
}