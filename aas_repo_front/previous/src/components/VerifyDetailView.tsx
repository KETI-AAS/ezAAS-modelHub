import { Flex, Button, Tooltip, ActionIcon } from "@mantine/core";
import { modals } from "@mantine/modals";
import React from "react";
import { IconBrowserMaximize } from "@tabler/icons-react";

interface VerificationMessage {
  count: number;
  message: string[];
}

interface Props {
  verificationRef: React.RefObject<Record<string, VerificationMessage>>;
  verificationActive: string;
  setVerificationActive: (key: string) => void;
}

export default function VerifyDetailView({
  verificationRef,
  verificationActive,
  setVerificationActive,
}: Props) {
  const handleOpen = () => {
    if (!verificationActive) return;
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
            <Button onClick={() => modals.closeAll()}>Close</Button>
          </Flex>
          <div className="text-muted fw-semibold fs-5">
            {Array.isArray(
              verificationRef.current?.[verificationActive]?.message
            ) &&
              verificationRef.current?.[verificationActive]?.message.map(
                (msg, i) => (
                  <React.Fragment key={i}>
                    {msg}
                    <br />
                  </React.Fragment>
                )
              )}
          </div>
        </>
      ),
    });
  };

  if (verificationRef.current == null) {
    return;
  }
  return (
    <div className="card mt-10 collapse show">
      <div
        className="card-header border-0 bg-light"
        style={{ minHeight: "50px" }}
      >
        <div className="card-title fs-4 fw-bold text-success">
          Verification Results
        </div>
      </div>
      <div>
        <form className="form">
          <div className="card-body border-top p-9">
            <div className="row">
              {verificationRef.current &&
                Object.entries(verificationRef.current).map(
                  ([k, { count }]) => {
                    const color = count > 0 ? "red" : "green";
                    const icon =
                      count > 0
                        ? "fa-solid fa-circle-exclamation"
                        : "fa-solid fa-circle-check";
                    return (
                      <div className="col-xl-4 col-sm-12" key={k}>
                        <div
                          className="card card-flush bgi-no-repeat bgi-size-contain bgi-position-x-center mb-xl-10"
                          onClick={() => setVerificationActive(k)}
                          style={{
                            backgroundColor: "#f8f8f8",
                            border:
                              k === verificationActive
                                ? `2px solid ${color}`
                                : undefined,
                            cursor: "pointer",
                          }}
                        >
                          <div className="card-body d-flex align-items-end">
                            <div className="d-flex align-items-center flex-column w-100">
                              <div className="d-flex justify-content-between w-100 mt-auto">
                                <span
                                  className="fs-3 fw-bold"
                                  style={{ color }}
                                >
                                  <i className={icon}></i> {k.toUpperCase()}
                                </span>
                                {count !== 0 && (
                                  <span
                                    className="fs-3 fw-bold"
                                    style={{ color }}
                                  >
                                    {count}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                )}
            </div>

            <div className="row">
              <div className="col-12 m-0">
                <div
                  className="d-flex align-items-center collapsible py-3 toggle mb-0"
                  data-bs-toggle="collapse"
                  data-bs-target="#kt_support_1_1"
                >
                  <div className="ms-n1 me-5">
                    <i className="ki-duotone ki-down toggle-on text-primary fs-2"></i>
                    <i className="ki-duotone ki-right toggle-off fs-2"></i>
                  </div>
                  <div className="d-flex align-items-center flex-wrap">
                    <Tooltip label="Open in Modal">
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
                    <h3 className="text-gray-800 fw-semibold cursor-pointer me-3 mb-0">
                      Fail View Details
                    </h3>
                  </div>
                </div>
                <div
                  id="kt_support_1_1"
                  className="collapse show fs-6 ms-10"
                  style={{ height: "200px", overflow: "auto" }}
                >
                  <div className="mb-4">
                    <div className="text-muted fw-semibold fs-5">
                      {Array.isArray(
                        verificationRef.current?.[verificationActive]?.message
                      ) &&
                        verificationRef.current?.[
                          verificationActive
                        ]?.message.map((msg, i) => (
                          <React.Fragment key={i}>
                            {msg}
                            <br />
                          </React.Fragment>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
