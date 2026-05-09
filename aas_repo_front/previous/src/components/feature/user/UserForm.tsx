"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { User } from "@/app/user/page";
import { getCodeList, upsertUser } from "@/api";
import { useQuery } from "@tanstack/react-query";
import { confirmSave } from "@/utils/modal";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { UserRole } from "@/constants/roles";
import { useAuth } from "@/contexts/AuthContext";

export type Mode = "edit" | "view";

interface UserFormProps {
  mode: Mode;
  user: User;
}

export default function UserForm({ mode, user }: UserFormProps) {
  const router = useRouter();
  const { user: loginUser } = useAuth();

  const { data: groups = [] } = useQuery({
    queryKey: ["common/code", "group"],
    queryFn: () => getCodeList("group"),
  });

  const { data: statusList = [] } = useQuery({
    queryKey: ["common/code", "SYS400"],
    queryFn: () => getCodeList("SYS400"),
  });

  const [userState, setUserState] = useState<Partial<User>>({
    user_name: user?.user_name,
    user_phonenumber: user?.user_phonenumber,
    user_group_seq: user?.user_group_seq,
    status: user?.status,
  });

  useEffect(() => {
    document.title = "사용자 정보 상세";
  }, []);

  // user prop 변경 시 userState 동기화
  useEffect(() => {
    if (user) {
      setUserState({
        user_name: user.user_name,
        user_phonenumber: user.user_phonenumber,
        user_group_seq: user.user_group_seq,
        status: user.status,
      });
    }
  }, [user]); // user prop이 변경될 때마다 이 effect를 실행합니다.

  const isReadOnly = mode === "view";

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setUserState((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async () => {
    if (await confirmSave("Do you want to save?")) {
      const userSeq = await upsertUser({
        body: {
          ...user,
          ...userState,
        },
        withToast: true,
      });
      router.push(ROUTES.USER.VIEW(userSeq));
    }
  };

  return (
    <>
      {/* begin::Toolbar */}
      <div className="toolbar py-5 py-lg-5" id="kt_toolbar">
        {/* begin::Container */}
        <div
          id="kt_toolbar_container"
          className="container-xxl d-flex flex-stack flex-wrap"
        >
          {/* begin::Page title */}
          <div className="page-title d-flex flex-column me-3">
            {/* begin::Title */}
            <h1 className="d-flex text-gray-900 fw-bold my-1 fs-3">
              My Profile - {mode ? mode.toUpperCase() : ""}
            </h1>
            {/* end::Title */}
            {/* begin::Breadcrumb */}
            <ul className="breadcrumb breadcrumb-dot fw-semibold text-gray-600 fs-7 my-1">
              {/* begin::Item */}
              <li className="breadcrumb-item text-gray-600">
                <Link
                  href={ROUTES.HOME}
                  className="text-gray-600 text-hover-primary"
                >
                  Home
                </Link>
              </li>
              {/* end::Item */}
              {/* begin::Item */}
              <li className="breadcrumb-item text-gray-600">My Profile</li>
              {/* end::Item */}
            </ul>
            {/* end::Breadcrumb */}
          </div>
          {/* end::Page title */}
          {Number(loginUser?.user_group_seq) <= UserRole.Approvedor && (
            <Link href={ROUTES.USER.LIST} className="btn btn-lightactive">
              <i className="fa-solid fa-list"></i> List
            </Link>
          )}
        </div>
        {/* end::Container */}
      </div>
      {/* end::Toolbar */}

      {/* begin::Container */}
      <div
        id="kt_content_container"
        className="d-flex flex-column-fluid align-items-start container-xxl"
      >
        {/* begin::Post */}
        <div className="content flex-row-fluid" id="kt_content">
          <div className="card mb-5 mb-xl-10">
            {/* begin::Card header */}
            <div
              className="card-header border-0 cursor-pointer"
              role="button"
              data-bs-toggle="collapse"
              data-bs-target="#kt_account_profile_details"
              aria-expanded="true"
              aria-controls="kt_account_profile_details"
            >
              {/* begin::Card title */}
              <div className="card-title m-0">
                <h3 className="fw-bold m-0">Profile Details</h3>
              </div>
              {/* end::Card title */}
            </div>
            {/* begin::Card header */}
            {/* begin::Content */}
            <div
              id="kt_account_settings_profile_details"
              className="collapse show"
            >
              <div className="card-body border-top p-9">
                <div className="row mb-6">
                  <label className="col-lg-2 col-form-label fw-semibold fs-6">
                    ID
                  </label>
                  <div className="col-lg-10 fv-row">
                    <input
                      type="text"
                      name="user_id"
                      className="form-control form-control-lg form-control-solid"
                      defaultValue={user.user_id}
                      readOnly
                    />
                  </div>
                </div>

                <div className="row mb-6">
                  <label className="col-lg-2 col-form-label fw-semibold fs-6">
                    Name
                  </label>
                  <div className="col-lg-4 fv-row">
                    <input
                      type="text"
                      name="user_name"
                      className="form-control form-control-lg form-control-solid"
                      value={userState.user_name}
                      onChange={handleChange}
                      readOnly={isReadOnly}
                    />
                  </div>
                  <label className="col-lg-2 col-form-label fw-semibold fs-6">
                    User Seq
                  </label>
                  <div className="col-lg-4 fv-row">
                    <input
                      type="text"
                      name="user_seq"
                      className="form-control form-control-lg form-control-solid"
                      defaultValue={user.user_seq}
                      readOnly
                    />
                  </div>
                </div>

                <div className="row mb-6">
                  <label className="col-lg-2 col-form-label fw-semibold fs-6">
                    Create Day
                  </label>
                  <div className="col-lg-4 fv-row">
                    <input
                      type="text"
                      className="form-control form-control-lg form-control-solid"
                      defaultValue={new Date(
                        user.start_timestamp
                      ).toLocaleDateString()}
                      readOnly
                    />
                  </div>
                  <label className="col-lg-2 col-form-label fw-semibold fs-6">
                    Subscription
                  </label>
                  <div className="col-lg-4 fv-row">
                    <input
                      type="text"
                      name="user_seq"
                      className="form-control form-control-lg form-control-solid"
                      defaultValue={userState.socialprovider_name ?? "Local"}
                      readOnly
                    />
                  </div>
                </div>

                <div className="row mb-6">
                  <label className="col-lg-2 col-form-label fw-semibold fs-6">
                    Role
                  </label>
                  <div className="col-lg-4 fv-row">
                    <select
                      name="user_group_seq"
                      className="form-select form-select-solid form-select-lg fw-semibold"
                      // value를 String()으로 감싸 타입을 일치시킵니다.
                      value={String(userState.user_group_seq)}
                      onChange={handleChange}
                      disabled={isReadOnly}
                    >
                      {Array.isArray(groups) &&
                        groups.map((group) => (
                          <option key={group.id} value={String(group.id)}>
                            {group.text}
                          </option>
                        ))}
                    </select>
                  </div>
                  <label className="col-lg-2 col-form-label fw-semibold fs-6">
                    Activate
                  </label>
                  <div className="col-lg-4 fv-row">
                    <select
                      name="status"
                      className="form-select form-select-solid form-select-lg fw-semibold"
                      value={String(userState.status)}
                      onChange={handleChange}
                      disabled={isReadOnly}
                    >
                      {Array.isArray(statusList) &&
                        statusList.map((status) => (
                          <option key={status.id} value={String(status.id)}>
                            {status.text}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>
              {mode !== "view" && (
                <div className="card-footer d-flex justify-content-end py-6 px-9">
                  <button
                    onClick={() => {
                      router.back();
                    }}
                    className="btn btn-light btn-sm me-2"
                  >
                    <i className="fa-solid fa-xmark"></i> Cancel
                  </button>
                  <button
                    className="btn btn-success btn-sm"
                    onClick={handleSubmit}
                  >
                    <i className="fa-regular fa-floppy-disk"></i> Save
                  </button>
                </div>
              )}
              {mode === "view" &&
                Number(loginUser?.user_group_seq) > UserRole.Approvedor && (
                  <div className="card-footer d-flex justify-content-end py-6 px-9">
                    <button
                      onClick={() => {
                        router.back();
                      }}
                      className="btn btn-light btn-sm me-2"
                    >
                      <i className="fa-solid fa-xmark"></i> Cancel
                    </button>
                  </div>
                )}

              {mode === "view" &&
                Number(loginUser?.user_group_seq) <= UserRole.Approvedor && (
                  <div className="card-footer d-flex justify-content-end py-6 px-9">
                    <Link
                      href={ROUTES.USER.EDIT(user.user_seq)}
                      className="btn btn-success btn-sm"
                    >
                      <i className="fa-regular fa-pen-to-square"></i> Edit
                    </Link>
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
