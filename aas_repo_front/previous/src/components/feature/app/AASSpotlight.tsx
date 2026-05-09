"use client";

import { useState } from "react";
import { Spotlight, spotlight } from "@mantine/spotlight";
import { IconSearch } from "@tabler/icons-react";
import AASSearchPreview from "../model/AASSearchPreivew";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ROUTES } from "@/constants/routes";

export default function AASSpotlight() {
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = useState(""); // 검색어
  const [isOpen, setIsOpen] = useState(false); // Spotlight 열림 여부

  return (
    <>
      {/* 검색 버튼 (헤더 영역) */}
      <div
        id="kt_header_search"
        className="header-search d-flex align-items-center w-lg-250px"
        onClick={() => {
          spotlight.open();
          setIsOpen(true);
        }}
      >
        {/* 모바일용 토글 */}
        <div
          data-kt-search-element="toggle"
          className="search-toggle-mobile d-flex d-lg-none align-items-center"
        >
          <div className="d-flex btn btn-icon btn-color-gray-700 btn-active-color-primary btn-outline btn-active-bg-light w-30px h-30px w-lg-40px h-lg-40px">
            <i className="ki-duotone ki-magnifier fs-1 text-gray-700 fs-2">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
          </div>
        </div>

        {/* 데스크탑 검색 입력창 */}
        <form
          data-kt-search-element="form"
          className="d-none d-lg-block w-100 position-relative mb-2 mb-lg-0"
          autoComplete="off"
        >
          <input type="hidden" />
          <i className="ki-duotone ki-magnifier fs-2 text-gray-700 position-absolute top-50 translate-middle-y ms-4">
            <span className="path1"></span>
            <span className="path2"></span>
          </i>
          <input
            type="text"
            className="form-control bg-transparent ps-13 fs-7 h-40px"
            name="search"
            defaultValue=""
            placeholder="Please enter an AAS search term"
            data-kt-search-element="input"
          />
        </form>
      </div>

      {/* Spotlight 검색 팝업 */}
      <Spotlight.Root
        query={query}
        onQueryChange={setQuery}
        onSpotlightClose={() => setIsOpen(false)}
      >
        <Spotlight.Search
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              window.location.href = `${window.location.origin}${ROUTES.AASMODEL.LIST}?title=${query}`;
            }
          }}
          placeholder="Search..."
          leftSection={<IconSearch stroke={1.5} />}
        />
        <Spotlight.ActionsList>
          <AASSearchPreview
            searchParams={{ title: query }}
            enabled={isOpen}
            renderWrapper={(children, model) => (
              <Spotlight.Action
                key={model.aasmodel_seq}
                onClick={() => {
                  window.location.href = `${window.location.origin}${ROUTES.AASMODEL.LIST}?title=${query}`;
                  //   user != null &&
                  //     router.push(ROUTES.AASMODEL.VIEW(model.aasmodel_seq));
                }}
              >
                {children}
              </Spotlight.Action>
            )}
          />
        </Spotlight.ActionsList>
      </Spotlight.Root>
    </>
  );
}
