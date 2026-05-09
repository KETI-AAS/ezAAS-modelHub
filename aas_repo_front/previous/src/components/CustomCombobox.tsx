import {
  Box,
  CheckIcon,
  Combobox,
  Flex,
  Input,
  LoadingOverlay,
  useCombobox,
} from "@mantine/core";
import { useIntersection } from "@mantine/hooks";
import React, { useMemo, useRef, useState, useEffect } from "react";

export type CustomComboboxItem =
  | string
  | { value?: string; label?: string; [key: string]: any };

type CustomComboboxProps = {
  className?: string;
  placeholder?: string;
  border?: boolean;

  data: CustomComboboxItem[] | undefined;
  mappingFn?: (item: Record<string, any>) => CustomComboboxItem;
  limit?: number;

  value: string;
  onChange: (value: string | undefined) => void;
  getItemValue: (item: CustomComboboxItem) => string;
  getItemLabel: (item: CustomComboboxItem) => string;
  renderComboboxOptionItem?: (item: CustomComboboxItem) => React.ReactNode;
};

function CustomCombobox({
  className = "",
  placeholder = "Select...",
  border = true,
  limit = 50,
  data,
  mappingFn,
  value,
  onChange,
  getItemValue,
  getItemLabel,
  renderComboboxOptionItem,
}: CustomComboboxProps) {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const { ref, entry } = useIntersection({
    root: containerRef.current,
    threshold: 0.9,
  });

  const [search, setSearch] = useState<string>("");
  const [offset, setOffset] = useState<number>(limit);
  const [selectedLabel, setSelectedLabel] = useState<string>("");

  const getOptionValue = (item: CustomComboboxItem) =>
    typeof item === "string"
      ? item
      : getItemValue
        ? getItemValue(item)
        : String(item?.value ?? "");

  const getOptionLabel = (item: CustomComboboxItem) =>
    typeof item === "string"
      ? item
      : getItemLabel
        ? getItemLabel(item)
        : String(item?.label ?? "");

  const mappedData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return mappingFn ? data.map(mappingFn) : data;
  }, [data, mappingFn]);

  const filteredOptions = useMemo(() => {
    return mappedData.filter((item) =>
      getOptionLabel(item).toLowerCase().includes(search.toLowerCase())
    );
  }, [mappedData, search]);

  const visibleOptions = useMemo(() => {
    return filteredOptions.slice(0, offset);
  }, [filteredOptions, offset]);

  const selected = useMemo(() => {
    return mappedData.find((item) => getOptionValue(item) === value);
  }, [mappedData, value]);

  useEffect(() => {
    if (selected) {
      const label = getOptionLabel(selected);
      setSelectedLabel(label);
      setSearch(label);
    } else {
      setSelectedLabel("");
      setSearch("");
    }
  }, [selected]);

  useEffect(() => {
    if (entry?.isIntersecting) {
      setOffset((prev) => prev + limit);
    }
  }, [entry, limit]);

  const renderOption = (item: CustomComboboxItem, index: number) => {
    const itemValue = getOptionValue(item);
    const label = renderComboboxOptionItem
      ? renderComboboxOptionItem(item)
      : getOptionLabel(item);

    return (
      <Combobox.Option
        value={itemValue}
        key={`${itemValue}-${index}`}
        active={itemValue === value}
      >
        <Flex align="center">
          {itemValue === value && (
            <CheckIcon size="1rem" style={{ marginRight: "0.5rem" }} />
          )}
          <label style={{ fontSize: "1rem" }}>{label}</label>
        </Flex>
      </Combobox.Option>
    );
  };

  return (
    <Combobox
      zIndex={2000}
      store={combobox}
      onOptionSubmit={(val) => {
        const item = mappedData.find((i) => getOptionValue(i) === val);
        const label = item ? getOptionLabel(item) : "";
        setSelectedLabel(label);
        setSearch(label);
        onChange?.(val);
        combobox.closeDropdown();
      }}
    >
      <Combobox.Target>
        <Flex
          align="center"
          style={{
            border: border ? "1px solid var(--bs-gray-300)" : 0,
            borderRadius: "0.625rem",
          }}
        >
          <input
            className={className}
            placeholder={placeholder}
            style={{ border: 0 }}
            value={search}
            onChange={(e) => {
              setSearch(e.currentTarget.value);
              setOffset(limit);
            }}
            onClick={() => {
              setSearch("");
              combobox.openDropdown();
            }}
            onFocus={() => combobox.openDropdown()}
            onBlur={() => {
              setSearch(value ? selectedLabel : "");
              combobox.closeDropdown();
            }}
          />
          {search !== "" && (
            <Input.ClearButton
              style={{ cursor: "pointer" }}
              size="1.5rem"
              onClick={() => {
                setSearch("");
                setSelectedLabel("");
                onChange?.(undefined);
              }}
            />
          )}
          <Combobox.Chevron
            size="2.5rem"
            style={{ cursor: "pointer" }}
            onClick={() => combobox.openDropdown()}
          />
        </Flex>
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options>
          <div
            ref={containerRef}
            style={{ maxHeight: 200, overflowY: "scroll" }}
          >
            <LoadingOverlay
              visible={false}
              zIndex={1000}
              overlayProps={{ radius: "sm", blur: 1 }}
              loaderProps={{ type: "bars" }}
            />
            {visibleOptions.length === 0 ? (
              <Combobox.Empty>Nothing found</Combobox.Empty>
            ) : (
              visibleOptions.map(renderOption)
            )}
            {visibleOptions.length > 0 && (
              <Box ref={ref} style={{ height: "1px" }} />
            )}
          </div>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}

export default CustomCombobox;
