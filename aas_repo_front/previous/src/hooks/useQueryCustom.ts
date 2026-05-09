import {
  keepPreviousData,
  useQuery,
  UseQueryOptions,
} from "@tanstack/react-query";
import { isRedirectError } from "next/dist/client/components/redirect-error";

export type UseQueryOptionsWithoutKeyAndFn = Omit<
  UseQueryOptions,
  "queryKey" | "queryFn"
>;

type CustomRequest = Pick<URL, "pathname"> &
  Pick<RequestInit, "method" | "headers"> & {
    base?: string;
    params?: Record<string, any>;
  };

export type UseQueryCustomParams = {
  fetchOptions: CustomRequest;
  queryOptions?: Omit<UseQueryOptions, "queryKey" | "queryFn">;
};

// URL과 파라미터를 받아서 데이터를 조회하는 훅
const useQueryCustom = ({
  fetchOptions: {
    base = `${process.env.NEXT_PUBLIC_AAS_API_BASE}:${process.env.NEXT_PUBLIC_AAS_API_PORT}`,
    pathname,
    method = "GET",
    params = {},
    headers,
  },
  queryOptions,
}: UseQueryCustomParams) => {
  // url 생성
  const url = new URL(pathname, base);

  // 페이지네이션 처리
  if (params.pagination) {
    const { pageIndex, pageSize } = params.pagination;
    url.pathname = `${pathname}/${pageIndex}/${pageSize}`;
  }

  // 요청 객체 생성
  const init: RequestInit = {};

  // method에 따라 파라미터 설정
  switch (method.toUpperCase()) {
    case "GET":
      url.search = new URLSearchParams(params).toString();
      break;
    case "POST":
      init.body = JSON.stringify(params);
      break;
    default:
      break;
  }

  // 헤더 설정
  init.headers = headers;

  const queryKey: [string, Record<string, any>] = [
    `${base}/${pathname}`,
    params,
  ];
  const useQueryResult = useQuery({
    queryKey: queryKey,
    queryFn: ({ queryKey }) => {
      return fetch(url, init).then(async (res) => {
        if (!res.ok) {
          throw new Error(`${res.status} (${res.statusText})`);
        }

        return res.json();
      });
    },
    retry: 1,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,

    ...queryOptions,
  });

  return { ...useQueryResult, queryKey };
};

export default useQueryCustom;
