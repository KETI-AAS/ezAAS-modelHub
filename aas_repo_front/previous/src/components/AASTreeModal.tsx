"use client";

import { Tooltip, ActionIcon, Button, Flex } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconBrowserMaximize } from "@tabler/icons-react";
import _ from "lodash";
import AASTree from "./feature/model/AASTree";

interface OpenTreeModalButtonProps {
  label?: string;
  treeData: any[] | undefined;
  treeDataRefCurrent?: React.RefObject<Record<string, any>>;
  metadata?: any;
  setMetaData?: (data: any) => void;
  mode: "create" | "edit" | "view";
}

export default function OpenTreeModalButton({
  label = "Open in Modal",
  treeData,
  treeDataRefCurrent,
  metadata,
  setMetaData,
  mode,
}: OpenTreeModalButtonProps) {
  const handleOpen = () => {
    modals.open({
      withCloseButton: false,
      fullScreen: true,
      closeOnEscape: false,
      children: (
        <>
          <Flex
            justify="flex-end"
            style={{ position: "sticky", top: 10, zIndex: 10 }}
          >
            <Button
              onClick={() => {
                modals.closeAll();

                if (
                  ["create", "edit"].includes(mode) &&
                  treeDataRefCurrent != null &&
                  setMetaData != null
                ) {
                  for (const key in treeDataRefCurrent) {
                    _.set(metadata, key, treeDataRefCurrent[key]);
                  }

                  treeDataRefCurrent = {};
                  setMetaData({ ...metadata });
                }
              }}
            >
              Close
            </Button>
          </Flex>

          {Array.isArray(treeData) && (
            <AASTree
              data={treeData}
              treeDataRefCurrent={treeDataRefCurrent}
              editMode={["create", "edit"].includes(mode)}
            />
          )}
        </>
      ),
    });
  };

  return (
    <Tooltip label={label}>
      <ActionIcon
        variant="transparent"
        color="gray.7"
        size="lg"
        style={{ marginRight: "0.5rem" }}
        onClick={handleOpen}
      >
        <IconBrowserMaximize />
      </ActionIcon>
    </Tooltip>
  );
}
