"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import SearchBox from "@/components/SearchBox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { MOCK_AAS_CATEGORIES, MOCK_SM_CATEGORIES } from "@/lib/mock-data";

export default function AASSearchBar() {
  const router = useRouter();
  const [modelType, setModelType] = useState<"aasmodel" | "submodel">("aasmodel");
  const [categorySeq, setCategorySeq] = useState<string>("all");
  const searchRef = useRef({ searchKey: "" });

  const categories =
    modelType === "aasmodel" ? MOCK_AAS_CATEGORIES : MOCK_SM_CATEGORIES;

  const handleSearch = () => {
    const route =
      modelType === "aasmodel" ? ROUTES.AASMODEL.LIST : ROUTES.SUBMODEL.LIST;
    const params: Record<string, string> = {
      title: searchRef.current.searchKey,
    };
    if (categorySeq && categorySeq !== "all") {
      params.category_seq = categorySeq;
    }
    router.push(`${route}?${new URLSearchParams(params).toString()}`);
  };

  return (
    <SearchBox onSearch={handleSearch}>
      {/* Model type */}
      <Select
        value={modelType}
        onValueChange={(value: string | null) => {
          if (value) setModelType(value as "aasmodel" | "submodel");
          setCategorySeq("all");
        }}
      >
        <SelectTrigger className="h-9 w-44 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="aasmodel">AAS Template</SelectItem>
            <SelectItem value="submodel">Submodel Template</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      {/* Category */}
      <Select value={categorySeq} onValueChange={(v: string | null) => { if (v) setCategorySeq(v); }}>
        <SelectTrigger className="h-9 w-48 shrink-0">
          <SelectValue placeholder="All Categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.text}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      {/* Keyword */}
      <div className="relative flex-1 min-w-40">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          className="h-9 pl-9"
          placeholder="Keyword Search"
          onChange={(e) => {
            searchRef.current.searchKey = e.target.value;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
        />
      </div>
    </SearchBox>
  );
}
