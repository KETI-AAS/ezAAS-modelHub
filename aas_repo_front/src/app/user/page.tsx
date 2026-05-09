"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import useSWR from "swr";
import { getUserList } from "@/api/index";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Search, Pencil, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 20;

export interface User {
  AAS_Seq_No?: number;
  user_seq: number;
  user_id: string;
  pw_hash?: string;
  user_name: string;
  status: "Y" | "N";
  status_nm: string;
  user_phonenumber: string | null;
  start_timestamp: string;
  socialaccount_seq?: number | null;
  social_id?: string | null;
  social_in_id?: string | null;
  socialprovider_seq?: number | null;
  socialprovider_name: string | null;
  user_group_seq: number | string;
  user_group_name: string;
  user_photo_url: string;
}

const GROUP_OPTIONS = [
  { id: "1", text: "System Manager" },
  { id: "2", text: "Template Manager" },
  { id: "3", text: "User" },
];

export default function UserPage() {
  const [inputValue, setInputValue] = useState("");
  const [searchKey, setSearchKey] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [page, setPage] = useState(1);

  const searchParams: Record<string, string> = {};
  if (searchKey) searchParams.searchKey = searchKey;
  if (groupFilter !== "all") searchParams.user_group_seq = groupFilter;

  const { data: userData, isLoading, error } = useSWR(
    ["user-list", page, searchKey, groupFilter],
    () =>
      getUserList({
        pageNumber: page,
        pageSize: PAGE_SIZE,
        searchParams,
      })
  );

  const users: User[] = userData?.list ?? userData ?? [];
  const totalCount: number = userData?.totalCount ?? userData?.total ?? users.length;
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
              <h1 className="text-xl font-bold text-foreground">Authority</h1>
              <nav className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Link href={ROUTES.HOME} className="hover:text-foreground">Home</Link>
                <span>/</span>
                <span>Authority</span>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-border bg-muted/30 px-6 py-3">
        <div className="mx-auto max-w-screen-2xl flex flex-wrap items-center gap-3">
          <Select
            value={groupFilter}
            onValueChange={(val) => { setGroupFilter(val ?? "all"); setPage(1); }}
          >
            <SelectTrigger className="h-8 w-44 text-sm">
              <SelectValue placeholder="Group All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Group All</SelectItem>
              {GROUP_OPTIONS.map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.text}</SelectItem>
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
                  <TableHead>Name / ID</TableHead>
                  <TableHead className="w-28">Social</TableHead>
                  <TableHead className="w-32">Create Date</TableHead>
                  <TableHead className="w-36">Role</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-16">Edit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.user_seq}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-xs">
                            {u.user_name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <Link
                            href={ROUTES.USER.VIEW(String(u.user_seq))}
                            className="text-sm font-medium text-foreground hover:text-primary hover:underline"
                          >
                            {u.user_name}
                          </Link>
                          <span className="text-xs text-muted-foreground">{u.user_id}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.socialprovider_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(u.start_timestamp).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm">{u.user_group_name}</TableCell>
                    <TableCell>
                      <Badge variant={u.status === "Y" ? "default" : "destructive"}>
                        {u.status_nm}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={ROUTES.USER.EDIT(String(u.user_seq))}
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
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      No users found.
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
