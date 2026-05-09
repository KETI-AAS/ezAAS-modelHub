"use client";
import { getModel } from "@/api";
import React, { useState } from "react";
import ModelForm from "../model/ModelForm";
import { modals } from "@mantine/modals";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "@mantine/core";

function DistributeDetailView({ modelType, modelSeq, children }) {
  const [opened, setOpened] = useState(false);

  const { data: model } = useQuery({
    queryKey: [modelType, modelSeq],
    queryFn: () =>
      getModel({
        modelType,
        modelSeq,
      }),
    enabled: opened && (modelType != null || modelSeq != null),
  });
  const handleClick = async () => {
    setOpened(true);
  };

  return (
    <>
      <div onClick={handleClick}>{children}</div>
      <Modal
        opened={opened}
        onClose={function (): void {
          setOpened(false);
        }}
        size={"70%"}
      >
        {Array.isArray(model) && (
          <ModelForm
            mode={"view"}
            model={model[0]}
            modelType={modelType}
            modalMode={true}
          />
        )}
      </Modal>
    </>
  );
}

export default DistributeDetailView;
