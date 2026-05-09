"use client";

import { Modal, Box, Text } from "@mantine/core";

interface FilePreviewModalProps {
  opened: boolean;
  onClose: () => void;
  fileUrl: string;
  fileType: string;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  opened,
  onClose,
  fileUrl,
  fileType,
}) => {
  const isPdf = fileType.toLowerCase().includes("pdf");

  return (
    <Modal opened={opened} onClose={onClose} title="File Preview" size="xl" centered>
      <Box style={{ height: "70vh" }}>
        {isPdf ? (
          <iframe src={fileUrl} width="100%" height="100%" title="File Preview" />
        ) : (
          <img src={fileUrl} alt="File Preview" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        )}
      </Box>
    </Modal>
  );
};

export default FilePreviewModal;