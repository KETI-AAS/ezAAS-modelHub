"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import useSWR from "swr";
import { getPublishedList } from "@/api/index";
import { ROUTES } from "@/constants/routes";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Plus, Search, Pencil, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 20;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  published: "default",
  draft: "secondary",
  temporary: "outline",
  deprecated: "destructive",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function DistributePage() {
  const [inputValue, setInputValue] = useState("");
  const [searchKey, setSearchKey] = useState("");
  const [statusFilter, setStatusFilter] = useState<"published" | "deprecated">("published");
  const [typeFilter, setTypeFilter] = useState<"all" | "aasmodel" | "submodel">("all");
  const [page, setPage] = useState(1);

  const searchParams: Record<string, string> = {};
  if (searchKey) searchParams.searchKey = searchKey;

  const { data: publishedData, isLoading, error } = useSWR(
    ["published-list", page, statusFilter, typeFilter, searchKey],
    () =>
      getPublishedList({
        status: statusFilter,
        type: typeFilter,
        pageNumber: page,
        pageSize: PAGE_SIZE,
        searchParams,
      })
  );

  const models: any[] = publishedData?.list ?? publishedData ?? [];
  const totalCount: number = publishedData?.totalCount ?? publishedData?.total ?? models.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleSearch = useCallback(() => {
    setSearchKey(inputValue);
    setPage(1);
  }, [inputValue]);

  return (
    <div className="flex flex-col">
      {/* Page header */}
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="mx-auto max-w-screen-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">Publish</h1>
              <nav className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Link href="/" className="hover:text-foreground">Home</Link>
                <span>/</span>
                <span>Publish</span>
              </nav>
            </div>
            <Link href="/distribute/ins" className={cn(buttonVariants({ size: "sm" }))}>
              <Plus data-icon="inline-start" />
              Register
            </Link>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-border bg-muted/30 px-6 py-3">
        <div className="mx-auto max-w-screen-2xl flex flex-wrap items-center gap-3">
          <Select
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter((val ?? "published") as "published" | "deprecated");
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-36 text-sm">
              <SelectValue placeholder="Published" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="deprecated">Deprecated</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={typeFilter}
            onValueChange={(val) => {
              setTypeFilter((val ?? "all") as "all" | "aasmodel" | "submodel");
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-36 text-sm">
              <SelectValue placeholder="Model All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Model All</SelectItem>
              <SelectItem value="aasmodel">AAS</SelectItem>
              <SelectItem value="submodel">Submodel</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[200px] max-w-sm flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                className="h-8 pl-8 text-sm"
                placeholder="Please enter a search term"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Button size="sm" className="h-8" onClick={handleSearch}>
              Search
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="mx-auto max-w-screen-2xl w-full px-6 py-6">
        <p className="mb-4 text-sm text-muted-foreground">
          {isLoading ? "Loading..." : `${totalCount} results found`}
        </p>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive mb-4">
            Failed to load data. Please check your connection or try again.
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded" />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Model Type</TableHead>
                  <TableHead>Template Name</TableHead>
                  <TableHead className="w-20">Version</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead>Template ID</TableHead>
                  <TableHead className="w-28">Published Date</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map((model: any) => (
                  <TableRow key={`${model.target_seq}-${model.ty}`}>
                    <TableCell>
                      <Badge
                        variant={model.ty === "aasmodel" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {model.ty === "aasmodel" ? "AAS" : "Submodel"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={ROUTES.DISTRIBUTE.VIEW({
                          modelType: model.ty as "aasmodel" | "submodel",
                          targetSeq: model.target_seq,
                        })}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {model.target_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {model.target_version && `v${model.target_version}`}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[model.status] ?? "outline"}>
                        {model.status_nm}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[200px]">
                      {model.tmp_seman_id}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {model.create_date ? formatDate(model.create_date) : "—"}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={ROUTES.DISTRIBUTE.EDIT({
                          modelType: model.ty as "aasmodel" | "submodel",
                          targetSeq: model.target_seq,
                        })}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "h-7 text-xs"
                        )}
                      >
                        <Pencil className="size-3" data-icon="inline-start" />
                        Edit
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
                {models.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      No published templates found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
