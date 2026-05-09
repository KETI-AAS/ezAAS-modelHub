import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

interface UseInfiniteSearchProps<T> {
  queryKey: unknown[];
  queryFn: (page: number) => Promise<T[]>;
  pageSize?: number;
  enabled?: boolean;
}

export default function useInfiniteModelSearch<T>({
  queryKey,
  queryFn,
  pageSize = 10,
  enabled = true,
}: UseInfiniteSearchProps<T>) {
  const queryClient = useQueryClient();
  const [lastPageNumber, setLastPageNumber] = useState<number | undefined>();

  const result = useInfiniteQuery<T[]>({
    initialPageParam: 1,
    queryKey,
    enabled,
    queryFn: ({ pageParam = 1 }) => queryFn(pageParam),
    getNextPageParam: (lastPage, allPages, lastPageParam) =>
      lastPage.length === pageSize ? allPages.length + 1 : lastPageParam,
  });

  const isLastPage = result.data?.pageParams.at(-1) === lastPageNumber;

  // 검색어 변경 시 마지막 페이지 번호 초기화
  useEffect(() => {
    setLastPageNumber(undefined);
  }, [JSON.stringify(queryKey)]);

  useEffect(() => {
    if (!result.data || result.data.pages.length === 0) return;

    const newPage = result.data.pages.at(-1);
    if (newPage?.length === 0) {
      setLastPageNumber(result.data.pageParams.at(-2));
      queryClient.setQueryData(queryKey, (data: any) => ({
        pages: data.pages.slice(0, -1),
        pageParams: data.pageParams.slice(0, -1),
      }));
    } else if (newPage?.length < pageSize) {
      setLastPageNumber(result.data.pageParams.at(-1));
    } else {
      setLastPageNumber(undefined);
    }
  }, [result.data]);

  const items = useMemo(() => result.data?.pages.flat() ?? [], [result.data]);

  return {
    ...result,
    items,
    isLastPage,
  };
}
