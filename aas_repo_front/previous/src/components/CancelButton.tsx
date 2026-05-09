// CancelButton.tsx (클라이언트 컴포넌트)
"use client";

import { useRouter } from "next/navigation";

export default function CancelButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      className="btn btn-light btn-sm me-2"
      onClick={() => router.back()}
    >
      <i className="fa-solid fa-xmark"></i> Cancel
    </button>
  );
}
