import React from "react";

interface TableCardProps {
  children: React.ReactNode;
}

export const TableCard = ({ children }: TableCardProps) => {
  return (
    <div className="col-md-6 col-xxl-3">
      <div className="card h-100">{children}</div>
    </div>
  );
};
