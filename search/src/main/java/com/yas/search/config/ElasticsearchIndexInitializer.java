package com.yas.search.config;

import com.yas.search.model.Product;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.IndexOperations;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class ElasticsearchIndexInitializer implements CommandLineRunner {

    private final ElasticsearchOperations elasticsearchOperations;

    @Override
    public void run(String... args) {
        try {
            IndexOperations indexOps = elasticsearchOperations.indexOps(Product.class);
            if (!indexOps.exists()) {
                log.info("Creating Elasticsearch index 'product' with custom settings and mappings...");
                indexOps.create();
                indexOps.putMapping(indexOps.createMapping(Product.class));
                log.info("Elasticsearch index 'product' created successfully.");
            } else {
                log.info("Elasticsearch index 'product' already exists.");
            }
        } catch (Exception e) {
            log.error("Failed to initialize Elasticsearch index 'product': {}", e.getMessage(), e);
        }
    }
}
