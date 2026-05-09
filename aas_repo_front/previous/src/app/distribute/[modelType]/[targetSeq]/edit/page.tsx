/*
 * 파일명: src/app/distribute/ins/page.tsx
 * 작성자: 김태훈
 * 작성일: 2024-03-15
 * 최종수정일: 2024-03-29
 *
 * 저작권: (c) 2025 IMPIX. 모든 권리 보유.
 *
 * 설명: AAS 템플릿 편집 페이지를 제공합니다.
 */

interface Props {
  params: {
    modelType: "aasmodel" | "submodel";
    targetSeq: string;
  };
}

import { getPublishedModel } from "@/api";
import DistributeForm from "@/components/feature/distribute/DistributeForm";
export default async function Page({ params }: Props) {
  const { modelType, targetSeq } = await params;

  let model = await getPublishedModel({
    modelType,
    target_seq: targetSeq,
  });
  return <>{model && <DistributeForm mode="edit" model={model.data[0]} />}</>;
}
