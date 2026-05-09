"use client";
import React from "react";
import { TableCard } from "../../TableCard";
import { exportModel } from "@/api";
import { ROUTES } from "@/constants/routes";
import { Menu } from "@mantine/core";
import Link from "next/link";
import { formatDateToDotYMD } from "@/utils";

interface ModelCardProps {
  model: Record<string, any>;
  i: number;
}

function DistributeCard({ model, i }: ModelCardProps) {
  return (
    <TableCard key={model["target_seq"] ?? i}>
      {/* 구분값 Published */}
      <div style={{ textAlign: "center" }}>
        <div
          className={`badge badge-light${model["ty"] == "aasmodel" ? "-primary" : ""}  bage_body`}
        >
          {model["ty"] == "aasmodel" ? "AAS" : "Submodel"}
        </div>
      </div>
      {/*begin::Card body*/}
      <div className="card-body d-flex flex-center flex-column pt-12 p-9">
        {/*begin::Avatar*/}
        <div className="symbol symbol-65px symbol-circle mb-5">
          <span
            className={`symbol-label fs-6 fw-semibold text-${model["status"] == "published" ? "primary" : ""} bg-light-warring text-center`}
          >
            {model["status_nm"]}
            <br />{" "}
            {model[`target_version`] ? "v" + model[`target_version`] : ""}
          </span>
        </div>
        {/*end::Avatar*/}
        {/*begin::Name*/}
        <Link
          style={{
            wordBreak: "break-all",
            overflowWrap: "break-word",
          }}
          href={ROUTES.DISTRIBUTE.VIEW({
            modelType: model.ty,
            targetSeq: model.target_seq,
          })}
          className="fs-4 text-gray-800 text-hover-primary fw-bold mb-0"
        >
          {model["target_name"]}
        </Link>
        {/*end::Name*/}
        {/*begin::Position*/}
        <div className="fw-semibold text-gray-500 mb-6">
          {formatDateToDotYMD(model["last_mod_date"])}
        </div>
        {/*end::Position*/}
        {/*begin::Info*/}
        <div className="d-flex flex-center flex-wrap">
          {/*begin::Stats*/}
          <div className="border border-gray-300 border-dashed rounded min-w-80px py-3 px-4 mx-2 mb-3">
            <div className="fw-semibold text-gray-500">
              <Link
                href={ROUTES.DISTRIBUTE.EDIT({
                  modelType: model.ty,
                  targetSeq: model.target_seq,
                })}
                className="btn btn-success btn-sm"
              >
                <i className="fa-regular fa-pen-to-square"></i> Edit
              </Link>
            </div>
          </div>

          {/*end::Stats*/}
        </div>
        {/*end::Info*/}
      </div>
      {/*end::Card body*/}
    </TableCard>
  );
}

export default DistributeCard;
