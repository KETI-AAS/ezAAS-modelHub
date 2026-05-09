"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import useSWR from "swr";
import { getInstanceList, getCodeList, exportModel } from "@/api/index";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/constants/roles";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Plus, Search, Download, Pencil, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 20;

export default function InstancePage() {
  const { user } = useAuth();

  const [inputValue, setInputValue] = useState("");
  const [searchKey, setSearchKey] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchMode, setSearchMode] = useState<"my" | "all">("all");
  const [page, setPage] = useState(1);

  const { data: categories = [] } = useSWR(
    "categories-instance",
    () => getCodeList("category")
  );

  const searchParams: Record<string, string> = {};
  if (searchKey) searchParams.searchKey = searchKey;
  if (searchMode === "my" && user) searchParams.user_seq = String(user.user_seq);

  const { data: instanceData, isLoading, error } = useSWR(
    ["instance-list", page, searchKey, categoryFilter, searchMode],
    () =>
      getInstanceList({
        category_seq: categoryFilter === "all" ? "0" : categoryFilter,
        pageNumber: page,
        pageSize: PAGE_SIZE,
        searchParams,
      })
  );

  const instances: any[] = instanceData?.list ?? instanceData ?? [];
  const totalCount: number = instanceData?.totalCount ?? instanceData?.total ?? instances.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleSearch = useCallback(() => {
    setSearchKey(inputValue);
    setPage(1);
  }, [inputValue]);

  const handleExport = async (instance: any, format: "json" | "xml" | "aasx") => {
    await exportModel({
      modelType: "aasmodel",
      modelSeq: instance.instance_seq,
      format,
      filename: instance.instance_name,
    });
  };

  const canCreate =
    user &&
    (user.user_group_seq === UserRole.User ||
      user.user_group_seq === UserRole.Manager);

  return (
    <div className="flex flex-col">
      {/* Page header */}
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="mx-auto max-w-screen-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">My AAS Instance</h1>
              <nav className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Link href="/" className="hover:text-foreground">Home</Link>
                <span>/</span>
                <span>My AAS Instance</span>
              </nav>
            </div>
            {canCreate && (
              <Link href="/instance/ins" className={cn(buttonVariants({ size: "sm" }))}>
                <Plus data-icon="inline-start" />
                Create AAS
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-border bg-muted/30 px-6 py-3">
        <div className="mx-auto max-w-screen-2xl flex flex-wrap items-center gap-3">
          {user && user.user_group_seq !== UserRole.User && (
            <div className="flex rounded-md border border-border overflow-hidden text-sm">
              {(["my", "all"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => { setSearchMode(mode); setPage(1); }}
                  className={`px-3 py-1.5 capitalize transition-colors ${
                    searchMode === mode
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {mode === "my" ? "My Instances" : "All Instances"}
                </button>
              ))}
            </div>
          )}

          <Select
            value={categoryFilter}
            onValueChange={(val) => { setCategoryFilter(val ?? "all"); setPage(1); }}
          >
            <SelectTrigger className="h-8 w-44 text-sm">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c: any) => (
                <SelectItem key={c.category_seq ?? c.id} value={String(c.category_seq ?? c.id)}>
                  {c.category_name ?? c.text}
                </SelectItem>
              ))}
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
                  <TableHead className="w-32">Category</TableHead>
                  <TableHead>Instance Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference Template ID</TableHead>
                  <TableHead className="w-32">Verification</TableHead>
                  {user && user.user_group_seq <= UserRole.Approvedor && (
                    <TableHead className="w-24">User</TableHead>
                  )}
                  {canCreate && (
                    <TableHead className="w-44">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {instances.map((instance: any) => {
                  const hasPermission =
                    user &&
                    (user.user_group_seq === UserRole.Manager ||
                      String(user.user_seq) === String(instance.create_user_seq));

                  return (
                    <TableRow key={instance.instance_seq}>
                      <TableCell className="text-sm">{instance.category_name}</TableCell>
                      <TableCell>
                        <Link
                          href={ROUTES.INSTANCE.VIEW(instance.instance_seq)}
                          className="font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {instance.instance_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {instance.description}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[180px]">
                        {instance.aasmodel_template_id}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={instance.verification === "success" ? "default" : "destructive"}
                        >
                          {instance.verification}
                        </Badge>
                      </TableCell>
                      {user && user.user_group_seq <= UserRole.Approvedor && (
                        <TableCell className="text-sm">{instance.user_id}</TableCell>
                      )}
                      {canCreate && (
                        <TableCell>
                          {hasPermission && (
                            <div className="flex items-center gap-1.5">
                              <DropdownMenu>
                                <DropdownMenuTrigger className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-input bg-background px-2.5 text-xs font-medium shadow-xs hover:bg-accent hover:text-accent-foreground">
                                  <Download className="size-3" />
                                  Export
                                  <ChevronDown className="size-3" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {(["json", "xml", "aasx"] as const).map((fmt) => (
                                    <DropdownMenuItem
                                      key={fmt}
                                      onClick={() => handleExport(instance, fmt)}
                                    >
                                      {fmt}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>

                              <Link
                                href={ROUTES.INSTANCE.EDIT(instance.instance_seq)}
                                className={cn(
                                  buttonVariants({ variant: "outline", size: "sm" }),
                                  "h-7 text-xs"
                                )}
                              >
                                <Pencil className="size-3" data-icon="inline-start" />
                                Edit
                              </Link>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {instances.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      No instances found.
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
