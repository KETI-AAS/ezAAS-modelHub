/*
 * 파일명: src/components/SearchBox.tsx
 * 설명: shadcn/ui 기반으로 재작성된 검색 박스 래퍼 컴포넌트.
 */
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface SearchBoxProps {
  onSearch: () => void;
  children?: React.ReactNode;
}

const SearchBox: React.FC<SearchBoxProps> = ({ onSearch, children }) => {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex flex-wrap items-center gap-3">
          {children}
          <Button type="button" onClick={onSearch}>
            <Search className="size-4" data-icon="inline-start" />
            Search
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SearchBox;
