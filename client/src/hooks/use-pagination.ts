import { useState, useMemo } from "react";

export function usePagination<T>(items: T[], pageSize: number = 10) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safeCurrentPage, pageSize]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  return {
    currentPage: safeCurrentPage,
    totalPages,
    paginatedItems,
    goToPage,
    totalItems: items.length,
    startIndex: (safeCurrentPage - 1) * pageSize + 1,
    endIndex: Math.min(safeCurrentPage * pageSize, items.length),
    hasNextPage: safeCurrentPage < totalPages,
    hasPrevPage: safeCurrentPage > 1,
  };
}
