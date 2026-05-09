"use client";
import React from "react";
import { Box, Flex, Text, ActionIcon } from "@mantine/core";
import { IconLayout2, IconLayoutList } from "@tabler/icons-react";
import { MantineReactTable, MRT_TableInstance } from "mantine-react-table";

interface FlexTableProps {
  layoutType: "flex" | "table";
  setLayoutType: (value: "flex" | "table") => void;
  table: MRT_TableInstance<any>;
  renderGridItem: (model: any, i: number) => React.ReactNode;
}

const pageSizeOptions = [
  { value: "8", label: "8" },
  { value: "16", label: "16" },
  { value: "24", label: "24" },
  { value: "32", label: "32" },
];

function FlexTable({
  layoutType,
  setLayoutType,
  table,
  renderGridItem,
}: FlexTableProps) {
  const options = {
    manualPagination: true,
    paginationDisplayMode: "pages",
    enablePagination: true,
    mantinePaginationProps: {
      rowsPerPageOptions: pageSizeOptions,
    },
    enableRowSelection: false,
    enableColumnActions: false,
    enableColumnFilters: false,
    enableTopToolbar: false,
    enableSorting: false,
    mantineTableHeadProps: {
      style: {
        display: layoutType === "flex" ? "none" : "initial",
        color: "gray",
        fontSize: "0.75rem",
      },
    },
    mantineTableBodyProps: {
      style: {
        display: layoutType === "flex" ? "none" : "initial",
        fontWeight: 600,
      },
    },
  };
  table.setOptions((prev) => ({
    ...prev,
    ...options,
  }));
  const rowModel = table.getRowModel();
  const rows = rowModel.rows.map((row) => row.original);
  return (
    <Box>
      <Flex mt="md" mb="sm" justify="space-between" align="center">
        <Text fz="lg" fw={600}>
          {rows.length} results found
        </Text>
        <div className="d-flex flex-wrap my-1">
          <ul className="nav nav-pills me-6 mb-2 mb-sm-0">
            <li className="nav-item m-0">
              <button
                className={`btn btn-sm btn-icon btn-light btn-color-muted btn-active-primary me-3 ${layoutType == "flex" ? "active" : ""}`}
                onClick={() => setLayoutType("flex")}
              >
                <i className="ki-outline ki-element-plus fs-2"></i>
              </button>
            </li>
            <li className="nav-item m-0">
              <button
                className={`btn btn-sm btn-icon btn-light btn-color-muted btn-active-primary ${layoutType == "table" ? "active" : ""}`}
                onClick={() => setLayoutType("table")}
              >
                <i className="ki-outline ki-row-horizontal fs-2"></i>
              </button>
            </li>
          </ul>
        </div>
      </Flex>

      {layoutType === "flex" && (
        <div className="row g-6 g-xl-12">{rows?.map(renderGridItem)}</div>
      )}
      <Box mt={"lg"}>
        <MantineReactTable table={table} />
      </Box>
    </Box>
  );
}

export default FlexTable;
