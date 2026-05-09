/*
 * 파일명: src/app/user/view/[id]/page.tsx
 * 작성자: 김태훈
 * 작성일: 2024-03-15
 * 최종수정일: 2024-03-29
 *
 * 저작권: (c) 2025 IMPIX. 모든 권리 보유.
 *
 * 설명: 사용자 프로필 수정 페이지를 제공합니다.
 */

import { getUser } from "@/api";
import UserForm from "@/components/feature/user/UserForm";

interface Props {
  params: {
    userSeq: string;
  };
}

export default async function Page({ params }: Props) {
  const { userSeq } = await params;
  const user = await getUser({
    userSeq,
  });

  return (
    <>
      {Array.isArray(user?.data) && (
        <UserForm mode={"edit"} user={user?.data[0]} />
      )}
    </>
  );
}
