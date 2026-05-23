package com.yas.search.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.elasticsearch.client.ClientConfiguration;
import org.springframework.data.elasticsearch.client.elc.ElasticsearchConfiguration;
import org.springframework.data.elasticsearch.repository.config.EnableElasticsearchRepositories;

@Configuration
@EnableElasticsearchRepositories(basePackages = "com.yas.search.repository")
@ComponentScan(basePackages = "com.yas.search.service")
@RequiredArgsConstructor
public class ImperativeClientConfig extends ElasticsearchConfiguration {

    private final ElasticsearchDataConfig elasticsearchConfig;

    @Override
    public ClientConfiguration clientConfiguration() {
        org.springframework.data.elasticsearch.support.HttpHeaders headers = new org.springframework.data.elasticsearch.support.HttpHeaders();
        headers.add("Accept", "application/vnd.elasticsearch+json;compatible-with=8");
        headers.add("Content-Type", "application/vnd.elasticsearch+json;compatible-with=8");

        return ClientConfiguration.builder()
                .connectedTo(elasticsearchConfig.getUrl())
                .withBasicAuth(elasticsearchConfig.getUsername(), elasticsearchConfig.getPassword())
                .withDefaultHeaders(headers)
                .build();
    }
}
