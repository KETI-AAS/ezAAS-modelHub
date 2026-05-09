import { modals } from "@mantine/modals";

export const confirmSave = (message: string, options = {}) =>
  new Promise<boolean>((resolve) => {
    modals.openConfirmModal({
      title: "Confirmation",
      centered: true,
      children: message ? message : "Do you want to save?",
      labels: { confirm: "Save", cancel: "Cancel" },
      confirmProps: { color: "blue" },
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
      ...options,
    });
  });
