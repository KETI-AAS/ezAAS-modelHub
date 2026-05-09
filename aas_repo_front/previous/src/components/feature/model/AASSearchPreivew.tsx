"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Center,
  Flex,
  Group,
  LoadingOverlay,
  Text,
} from "@mantine/core";
import { getModelList } from "@/api";
import useInfiniteSearch from "@/hooks/useInfiniteSearch";
import { AASModel } from "@/types/aas";

interface AASSearchPreviewProps {
  searchParams: object;
  enabled?: boolean;
  renderWrapper?: (child: React.ReactNode, model: AASModel) => React.ReactNode;
}

export default function AASSearchPreview({
  searchParams,
  enabled = true,
  renderWrapper,
}: AASSearchPreviewProps) {
  const pageSize = 10; // 호출할 행 크기
  const queryKey = ["aasmodel", searchParams];

  const {
    items: models,
    fetchNextPage,
    isFetchingNextPage,
    isLastPage,
    refetch,
  } = useInfiniteSearch<AASModel>({
    queryKey,
    enabled: enabled,
    queryFn: (page) =>
      getModelList({
        modelType: "aasmodel",
        pageNumber: page,
        pageSize,
        searchParams,
      }).then((res) => res.data),
  });

  const bodyRef = useRef(null); // 스크롤 영역 ref
  const observerRef = useRef<IntersectionObserver | null>(null);

  // ⬇스크롤 바닥 도달 시 fetchNextPage() 실행
  const scrollRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();

      if (node) {
        observerRef.current = new IntersectionObserver(([entry]) => {
          if (!entry.isIntersecting) return;

          if (isFetchingNextPage) {
            fetchNextPage(); // 바닥 도달 시 데이터 더 불러오기
          }
        });

        observerRef.current.observe(node);
      }
    },
    [fetchNextPage, isFetchingNextPage]
  );

  // Spotlight 항목 리스트 구성
  const items = useMemo(
    () =>
      models.map((model) => {
        const thumbnail = model.aasmodel_img
          ? `data:${model.mime_type};base64,${model.aasmodel_img}`
          : null;

        const content = (
          <Group
            wrap="nowrap"
            w="100%"
            style={{
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <Center>
              <img
                src={thumbnail}
                alt={model.filename}
                width={50}
                height={50}
              />
            </Center>
            <div style={{ flex: 1 }}>
              <Text>{model.aasmodel_name}</Text>
              {model.description && (
                <Text opacity={0.6} size="xs">
                  {model.description}
                </Text>
              )}
            </div>
            {new Date().toDateString() ===
              new Date(model.create_date).toDateString() && (
              <span className="badge badge-light-success me-2">New</span>
            )}
          </Group>
        );

        return renderWrapper ? (
          renderWrapper(content, model)
        ) : (
          <div key={model.aasmodel_seq}>{content}</div> // ✅ key를 여기서 직접 넣거나
        );
      }),
    [models, renderWrapper]
  );

  return (
    <>
      <LoadingOverlay
        visible={isFetchingNextPage}
        zIndex={1000}
        overlayProps={{ radius: "sm", blur: 1 }}
        loaderProps={{ type: "bars" }}
      />
      <div ref={bodyRef} style={{ maxHeight: 400, overflowY: "scroll" }}>
        {items.length > 0 ? (
          <Flex direction="column" gap="xs">
            {items}
            {/* 마지막 페이지 도달 시 안내 */}
            {isLastPage ? (
              <div
                style={{
                  cursor: "pointer",
                  userSelect: "none",
                  color: "var(--mantine-color-dimmed)",
                  padding: "var(--mantine-spacing-md)",
                  textAlign: "center",
                }}
                onClick={() => {
                  refetch();
                }}
              >
                That's all for now. Click here to check for the latest data.
              </div>
            ) : (
              <div ref={scrollRef} style={{ height: "1px" }} />
            )}
          </Flex>
        ) : (
          // 데이터가 전혀 없을 경우
          <div
            style={{
              cursor: "pointer",
              userSelect: "none",
              color: "var(--mantine-color-dimmed)",
              padding: "var(--mantine-spacing-md)",
              textAlign: "center",
            }}
            onClick={() => {
              refetch();
            }}
          >
            No data available. Click here to check for the latest data.
          </div>
        )}
      </div>
    </>
  );
}
