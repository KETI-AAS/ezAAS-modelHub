/*
 * 파일명: src/components/GlobalInit.tsx
 * 작성자: 김태훈
 * 작성일: 2024-03-15
 * 최종수정일: 2024-03-29
 * 
 * 저작권: (c) 2025 IMPIX. 모든 권리 보유.
 * 
 * 설명: Metronic 테마의 컴포넌트들을 초기화하는 컴포넌트입니다.
 */


import {useEffect} from "react";
// import KTComponent from "../metronic/core";
// import KTLayout from "../metronic/app/layouts/demo1";
import {usePathname} from "next/navigation";

export default function GlobalInit() {
    const pathname = usePathname();

    useEffect(() => {
        // KTComponent.init();
        // KTLayout.init();
    }, [pathname]);

    return <></>
}