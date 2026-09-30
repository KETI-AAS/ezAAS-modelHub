/*
 * 파일명: src/app/instance/page.tsx
 * 작성자: 김태훈
 * 작성일: 2024-03-15
 * 최종수정일: 2024-03-29
 *
 * 저작권: (c) 2025 IMPIX. 모든 권리 보유.
 *
 * 설명: AAS 인스턴스 목록 페이지를 제공합니다.
 */

"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { getCodeList, exportModel, getInstanceList, downloadInstanceServer } from "@/api";
import { ROUTES } from "@/constants/routes";
import { Modal, Badge, Flex, Anchor, Menu, Text, SegmentedControl, Code, Box, Button } from "@mantine/core";
import { useDisclosure } from '@mantine/hooks';
import { useQuery } from "@tanstack/react-query";
import {
  MRT_PaginationState,
  MRT_RowData,
  useMantineReactTable,
  MantineReactTable,
} from "mantine-react-table";
import CustomCombobox from "@/components/CustomCombobox";
import SearchBox from "@/components/SearchBox";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/constants/roles";
import CategoryCombobox from "@/components/CategoryCombobox";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const { user, authToken } = useAuth();

  // Instance POTAL 이동
  const handlePortalClick = (instance_seq: any, isDeployed: boolean) => {
    let portalUrl: string;
    if (isDeployed) {
      portalUrl = `${process.env.NEXT_PUBLIC_PORTAL_URL}/instances?instance_seq=${instance_seq}`;
    } else {
      portalUrl = `${process.env.NEXT_PUBLIC_PORTAL_URL}/deployments`;
    }
    window.open(portalUrl, "_blank");
  };
  
  // 검색 박스 상태 값
  const [searchState, setSearchState] = useState({
    category_seq: "all",
    searchKey: "",
  });

  // ▼▼▼ [1] System Manager(1)는 'all', User(3)는 'my' 기본값 설정 ▼▼▼
  const [searchMode, setSearchMode] = useState<"my" | "all">("all");

  const [opened, { open, close }] = useDisclosure(false);
  const [serverModalData, setServerModalData] = useState<{ path: string; files: string[] } | null>(null);

  useEffect(() => {
    if (user) {
      setSearchMode(user.user_group_seq === UserRole.User ? "my" : "all");
    }
  }, [user]);

  // enter or click button
  const searchRef = useRef({
    searchKey: "",
  });

  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const { data: categorys = [] } = useQuery({
    queryKey: ["common/code", "category"],
    queryFn: () => getCodeList("category"),
  });


  // 서버 생성 핸들러
  const handleCreateServer = async (seq: number | string) => {
    if(!confirm("서버 파일을 생성(또는 재생성) 하시겠습니까?")) return;
    
    await downloadInstanceServer(seq);
    refetch(); // 리스트 갱신하여 버튼 상태 업데이트
  };

// 상세 보기 핸들러
  const handleViewDetails = (row: any) => {
  const path = row.server_path || "N/A";
  const seq = row.instance_seq;
  const name = row.instance_name || "model";

  // 백엔드와 동일한 이름 정규화 규칙 적용
  const safeName = name.trim().replace(/[\s/\\]/g, "_");
  
  // 백엔드에서 실제로 생성되는 3가지 파일로 목록 업데이트
  const files = [
    `${seq}_${safeName}_model.json`, // 모델 파일
    "config.json",                   // 설정 파일
    `${seq}_${safeName}_Dockerfile`  // 도커 빌드 파일
  ];
  
  setServerModalData({ path, files });
  open();
};



  const {
    data: models,
    isFetching: isFetchingModels,
    isSuccess,
    refetch,
  } = useQuery({
    queryKey: ["instanceList", pagination, searchState, searchMode, user?.user_seq],
    queryFn: () => {
      // API 호출 시 create_user_seq 파라미터
      const params: any = {
        ...searchState,
        p: "p",
      };

      // 'my' 모드이고 유저 정보가 있을 때만 create_user_seq 전달
      if (searchMode === "my" && user?.user_seq) {
        params.create_user_seq = user.user_seq;
      }

      return getInstanceList({
        category_seq: searchState.category_seq,
        pageNumber: pagination.pageIndex + 1,
        pageSize: pagination.pageSize,
        searchParams: params,
      });
    },
    enabled: !!user, // 유저 정보가 로드된 후 실행
  });

  const modelsData = models?.data ?? [];

  const handleExport = (format, model) => {
    exportModel({
      modelType: "instance",
      format,
      modelSeq: model[`instance_seq`],
      filename: model[`instance_name`],
      source: "db",
    });
  };

  const handleSearch = () => {
    const keyword = searchRef.current.searchKey;

    if (searchState.searchKey === keyword) {
      refetch();
    } else {
      setSearchState((prev) => ({ ...prev, searchKey: keyword }));
    }
  };

  const tableColumns = useMemo(() => {
    const columns = [
      {
        accessorKey: "category_name",
        header: "Category",
        size: 110,
      },
      {
        accessorKey: "instance_name",
        header: "Instance Name",
        Cell: ({ row }) => (
          <div className="d-flex flex-column justify-content-center">
            <Link
              href={ROUTES.INSTANCE.VIEW(row.original.instance_seq)}
              className="mb-1 text-gray-800 text-hover-primary"
            >
              {row.original.instance_name}
            </Link>
          </div>
        ),
      },
      {
        accessorKey: "description",
        header: "Description",
      },
      {
        accessorKey: "aasmodel_template_id",
        header: "Reference Template ID",
      },
      {
        accessorKey: "verification",
        header: "Verification Result",
        size: 120,
        Cell: ({ cell }) => {
          return (
            <Badge
              mt={4}
              mr={4}
              color={cell.getValue() === "success" ? "green" : "red.4"}
              radius="sm"
            >
              {cell.getValue()}
            </Badge>
          );
        },
      },
    ];

    if (user) {
      // System Manager(1) 또는 Template Manager(2)는 UserID 확인 가능
      if (user.user_group_seq <= UserRole.Approvedor) {
        columns.push({
          accessorKey: "user_id",
          header: "UserID",
          Cell: ({ row }) => (
            <Text fz="sm" fw={600}>
              {row.original.user_id}
            </Text>
          ),
        });
      }

      // ▼▼▼ [3] Export 및 Edit 버튼 권한 ▼▼▼
      // System Manager(1) 이거나 User(3)일 때 컬럼 표시
      if (user.user_group_seq === UserRole.Manager || user.user_group_seq === UserRole.User) {
        columns.push(
          {
            accessorKey: "actions", // 키 이름 변경
            header: "Download / Edit",
            size: 205,
            Cell: ({ row }) => {
              // 권한 체크: System Manager(1) 이거나 본인이 만든 글일 경우
              const hasPermission = 
                user.user_group_seq === UserRole.Manager || 
                // 타입 불일치 방지를 위해 == 사용 (string/number 비교)
                user.user_seq == row.original.create_user_seq;

              if (!hasPermission) return <></>;

              // 서버 생성 여부 확인
              const isDeployed = !!row.original.server_created;

              return (
                <Flex gap="xs" align="center">
                  {/* Export Button */}
                  <Menu shadow="md" width={200}>
                    <Menu.Target>
                      <button
                        className="btn btn-success btn-sm dropdown-toggle"
                        type="button"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                      >
                        Export
                      </button>
                    </Menu.Target>
                    <Menu.Dropdown>
                      {["json", "xml", "aasx"].map((format) => (
                        <Menu.Item
                          key={format}
                          onClick={() => handleExport(format, row.original)}
                        >
                          {format}
                        </Menu.Item>
                      ))}
                    </Menu.Dropdown>
                  </Menu>

                  {/* Edit Button */}
                  <Link
                    href={ROUTES.INSTANCE.EDIT(row.original.instance_seq)}
                    className="btn btn-light-success btn-sm"
                  >
                    <i className="fa-regular fa-pen-to-square"></i> Edit
                  </Link>

                  {/* POTAL Link Button */}
                  {/* <button
                    onClick={() => handlePortalClick(row.original.instance_seq, isDeployed)}
                    className={`btn btn-sm ${isDeployed ? "btn-primary" : "btn-outline btn-outline-primary"}`}
                  >
                    <i className="fa-solid fa-server"></i> POTAL
                  </button> */}


                  {/* Server Context Menu Button  */}
                  {/* <Menu shadow="md" width={200} position="bottom-end">
                    <Menu.Target>
                      <button
                        className={`btn btn-sm ${isDeployed ? "btn-primary" : "btn-outline btn-outline-primary"} dropdown-toggle`}
                        style={{ fontWeight: "bold" }}
                        title="Server Actions"
                      >
                         {isDeployed ? "Deployed" : "Server"}
                      </button>
                    </Menu.Target>

                    <Menu.Dropdown>
                      <Menu.Label>Server Actions</Menu.Label>
                      
                      <Menu.Item 
                        leftSection={<i className="fa-solid fa-server"></i>}
                        onClick={() => handleCreateServer(row.original.instance_seq)}
                      >
                        {isDeployed ? "Re-create Server" : "Create Server"}
                      </Menu.Item>

                      <Menu.Item 
                        leftSection={<i className="fa-solid fa-circle-info"></i>}
                        onClick={() => handleViewDetails(row.original)}
                        disabled={!isDeployed}
                      >
                        Server Details
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu> */}
                </Flex>
              );
            },
          }
        );
      }
    }
    return columns;
  }, [user, isFetchingModels]);

  const table = useMantineReactTable({
    columns: tableColumns,
    data: modelsData as MRT_RowData[],
    rowCount: models?.recordsTotal ?? 0,
    state: {
      pagination,
      showSkeletons: isFetchingModels,
    },
    enableColumnPinning: true,
    initialState: {
      columnPinning: {
        // right: ["externalButtons"],
      },
    },
    layoutMode: "grid",
    paginationDisplayMode: "pages",
    manualPagination: true,
    enablePagination: true,
    onPaginationChange: setPagination,
    mantineTableBodyCellProps: {
      styles: {
        td: {
          wordBreak: "break-all",
          overflowWrap: "break-word",
        },
      },
    },
  });

  return (
    <div>
      {/*begin::Toolbar*/}
      <div className="toolbar py-5 py-lg-5" id="kt_toolbar">
        {/*begin::Container*/}
        <div
          id="kt_toolbar_container"
          className="container-xxl d-flex flex-stack flex-wrap"
        >
          {/*begin::Page title*/}
          <div className="page-title d-flex flex-column me-3">
            {/*begin::Title*/}
            <h1 className="d-flex text-gray-900 fw-bold my-1 fs-3">
              My AAS Instance
            </h1>
            {/*end::Title*/}
            {/*begin::Breadcrumb*/}
            <ul className="breadcrumb breadcrumb-dot fw-semibold text-gray-600 fs-7 my-1">
              {/*begin::Item*/}
              <li className="breadcrumb-item text-gray-600">
                <Link href="/" className="text-gray-600 text-hover-primary">
                  Home
                </Link>
              </li>
              {/*end::Item*/}
              {/*begin::Item*/}
              <li className="breadcrumb-item text-gray-600">My AAS Instance</li>
              {/*end::Item*/}
            </ul>
            {/*end::Breadcrumb*/}
          </div>
          {/*end::Page title*/}
          {/*begin::Actions*/}
          <div className="d-flex align-items-center py-2 py-md-1">
            {/* ▼▼▼ [4] Create AAS 버튼 권한 수정 (System Manager 포함) ▼▼▼ */}
            {user && (user.user_group_seq === UserRole.User || user.user_group_seq === UserRole.Manager) && (
              <Link href="/instance/ins" className="btn btn-success fw-bold">
                <i className="fa-solid fa-tablet"></i> Create AAS
              </Link>
            )}
            {/*end::Button*/}
          </div>
          {/*end::Actions*/}
        </div>
        {/*end::Container*/}
      </div>
      {/*end::Toolbar*/}
      {/*begin::Container*/}
      <div
        id="kt_content_container"
        className="d-flex flex-column-fluid align-items-start container-xxl"
      >
        {/*begin::Post*/}
        <div className="content flex-row-fluid" id="kt_content">
          <div>
            <div>
              <SearchBox onSearch={handleSearch}>
                {/* ▼▼▼ [5] 화면에 SegmentedControl(필터 버튼) 추가 ▼▼▼ */}
                {user && user.user_group_seq !== UserRole.User && (
                  <SegmentedControl
                    value={searchMode}
                    onChange={(value: "my" | "all") => setSearchMode(value)}
                    data={[
                      { label: "My Instances", value: "my" },
                      { label: "All Instances", value: "all" },
                    ]}
                    color="blue"
                    className="me-4"
                  />
                )}
                
                <div className="col-lg-3 d-flex align-items-center mb-lg-0">
                  <i className="ki-outline ki-element-11 fs-1 text-gray-500 me-1"></i>
                  <CategoryCombobox
                    className="border-0"
                    code="aas_category"
                    value={searchState.category_seq}
                    setValue={(value) =>
                      setSearchState((prev) => ({
                        ...prev,
                        category_seq: value ?? "all",
                        searchKey: searchRef.current.searchKey,
                      }))
                    }
                  />
                </div>

                {/* Search Input */}
                <div className="position-relative w-md-400px me-md-2">
                  <i className="ki-outline ki-magnifier fs-3 text-gray-500 position-absolute top-50 translate-middle ms-6"></i>
                  <input
                    type="text"
                    className="form-control form-control-solid ps-10"
                    name="search"
                    onChange={(e) => {
                      searchRef.current.searchKey = e.target.value;
                    }}
                    onKeyDown={(e) => {
                      if (e.key == "Enter") {
                        handleSearch();
                      }
                    }}
                    placeholder="Please enter a search term"
                  />
                </div>
              </SearchBox>
            </div>

            <div className="d-flex flex-wrap flex-stack pb-7">
              {/*begin::Title*/}
              <div className="d-flex flex-wrap align-items-center my-1">
                <h3 className="fw-bold me-5 my-1">
                  {modelsData.length} results found
                  <span className="text-gray-500 fs-6">↓</span>
                </h3>
              </div>
              {/*end::Title*/}
              {/*begin::Controls*/}
            </div>

            <div id="kt_project_users_table_pane">
              <MantineReactTable table={table} />
            </div>


            {/* 서버 상세 정보 모달 */}
            <Modal opened={opened} onClose={close} title={<Text fw={700} size="lg">✅ Server Deployed Details</Text>} centered>
                {/* <Box mb="md">
                    <Text size="sm" c="dimmed" mb={5} fw={700}>Server Directory Path:</Text>
                    <Code block color="blue" style={{ wordBreak: 'break-all' }}>
                        {serverModalData?.path}
                    </Code>
                </Box> */}
                <Box mb="md">
                    <Text size="sm" c="dimmed" mb={5} fw={700}>Server Link</Text>
                    <Button
                        component="a"
                        href="https://ezmodel-hub.re.kr/portainer/#!/1/docker/images"
                        target="_blank"
                        rel="noopener noreferrer"
                        color="blue"
                        fullWidth
                        h="40px"
                        style={{ wordBreak: 'break-all', whiteSpace: 'normal' }}
                    >
                        Go to Server
                    </Button>
                </Box>

                <Box>
                    <Text size="sm" c="dimmed" mb={5} fw={700}>Generated Files:</Text>
                    <Flex direction="column" gap="xs">
                        {serverModalData?.files.map((file, idx) => (
                            <Badge key={idx} variant="outline" color="gray" size="lg" leftSection="📄">
                                {file}
                            </Badge>
                        ))}
                    </Flex>
                </Box>
                
                <Flex justify="flex-end" mt="xl">
                    <Button onClick={close} variant="light">Close</Button>
                </Flex>
            </Modal>


          </div>
        </div>
        {/*end::Post*/}
      </div>
      {/*end::Container*/}
    </div>
  );
}