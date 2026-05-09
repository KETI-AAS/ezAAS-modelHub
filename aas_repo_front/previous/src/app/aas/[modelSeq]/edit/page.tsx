/*
 * 파일명: src/app/aas/view/[id]/page.tsx
 * 작성자: 김태훈
 * 작성일: 2024-03-15
 * 최종수정일: 2024-03-29
 *
 * 저작권: (c) 2025 IMPIX. 모든 권리 보유.
 *
 * 설명: AAS 템플릿 상세 조회 페이지를 제공합니다.
 */

import ModelForm from "@/components/feature/model/ModelForm";
import { getModel } from "@/api";

interface Props {
  params: {
    modelSeq: string;
  };
}

export default async function Page({ params }: Props) {
  const { modelSeq } = await params;

  const model = await getModel({
    modelType: "aasmodel",
    modelSeq,
  });

  return (
    <>
      {Array.isArray(model) && (
        <ModelForm mode={"edit"} model={model[0]} modelType={"aasmodel"} />
      )}
    </>
  );
}
