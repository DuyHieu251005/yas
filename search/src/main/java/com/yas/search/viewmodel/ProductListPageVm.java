package com.yas.search.viewmodel;

import java.util.List;

public record ProductListPageVm(
        List<ProductSummaryVm> productContent,
        int pageNo,
        int pageSize,
        int totalElements,
        int totalPages,
        boolean isLast
) {
}
