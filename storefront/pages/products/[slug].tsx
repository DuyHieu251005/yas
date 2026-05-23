import { GetServerSideProps, GetServerSidePropsContext } from 'next';
import Head from 'next/head';
import { Fragment, useEffect, useState } from 'react';
import { Container, Table } from 'react-bootstrap';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';

import BreadcrumbComponent from '../../common/components/BreadcrumbComponent';

import { BreadcrumbModel } from '../../modules/breadcrumb/model/BreadcrumbModel';
import { ProductDetails, RelatedProduct } from '../../modules/catalog/components';
import { ProductDetail } from '../../modules/catalog/models/ProductDetail';
import { ProductOptions } from '../../modules/catalog/models/ProductOptions';
import { ProductVariation } from '../../modules/catalog/models/ProductVariation';
import {
  getProductDetail,
  getProductOptionValueByProductId,
  getProductOptionValues,
  getProductVariationsByParentId,
} from '../../modules/catalog/services/ProductService';


import { ProductOptionValueDisplay } from '@/modules/catalog/models/ProductOptionValueGet';

type Props = {
  product: ProductDetail;
  productOptions?: ProductOptions[];
  productVariations?: ProductVariation[];
  pvid: string | null;
};

// Function to fetch and sort product variations
const fetchAndSortProductVariations = async (productId: number): Promise<ProductVariation[]> => {
  try {
    let productVariations = await getProductVariationsByParentId(productId);
    if (productVariations && productVariations.length > 0) {
      productVariations = productVariations.sort((a, b) => {
        return Object.keys(a.options).length - Object.keys(b.options).length;
      });
    }
    return productVariations;
  } catch (error) {
    console.error(error);
    return [];
  }
};

export const getServerSideProps: GetServerSideProps = async (
  context: GetServerSidePropsContext
) => {
  const { slug, pvid } = context.query;

  // fetch product by slug
  const product = await getProductDetail(slug as string);
  if (!product.id) return { notFound: true };

  const productOptions: ProductOptions[] = [];
  let productVariations: ProductVariation[] = [];

  if (product.hasOptions) {
    // fetch product options
    try {
      const productOptionValues = await getProductOptionValues(product.id);

      for (const optionValue of productOptionValues) {
        const index = productOptions.findIndex(
          (productOption) => productOption.name === optionValue.productOptionName
        );
        if (index > -1) {
          productOptions.at(index)?.value.push(optionValue.productOptionValue);
        } else {
          const newProductOption: ProductOptions = {
            id: optionValue.productOptionId,
            name: optionValue.productOptionName,
            value: [optionValue.productOptionValue],
          };

          productOptions.push(newProductOption);
        }
      }
    } catch (error) {
      console.error(error);
    }

    // fetch product variations
    productVariations = await fetchAndSortProductVariations(product.id);
  }

  return {
    props: {
      product,
      productOptions,
      productVariations,
      pvid: pvid !== undefined ? (pvid as string) : null,
    },
  };
};

const ProductDetailsPage = ({ product, productOptions, productVariations, pvid }: Props) => {
  const [productOptionValueGet, setProductOptionValueGet] = useState<ProductOptionValueDisplay[]>(
    []
  );

  useEffect(() => {
    getProductOptionValueByProductId(product.id).then((res) => {
      setProductOptionValueGet(res);
    });
  }, [product.id]);

  const category: BreadcrumbModel = {
    pageName: product.productCategories.toString(),
    url: '#',
  };

  const crumb: BreadcrumbModel[] = [
    {
      pageName: 'Home',
      url: '/',
    },
    {
      pageName: product.name,
      url: '',
    },
  ];

  if (product.productCategories.toString()) {
    crumb.splice(1, 0, category);
  }

  return (
    <Container>
      <Head>
        <title>{product.name}</title>
      </Head>
      <BreadcrumbComponent props={crumb} />

      <ProductDetails
        product={product}
        productOptions={productOptions}
        productVariations={productVariations}
        productOptionValueGet={productOptionValueGet}
        pvid={pvid}
        averageStar={0}
        totalRating={0}
      />

      {/* Product Attributes */}
      <div className="container" style={{ marginTop: '70px' }}>
        <Table>
          {product.productAttributeGroups.map((attributeGroup) => (
            <Fragment key={attributeGroup.name}>
              <thead key={attributeGroup.name}>
                <tr className="product_detail_tr">
                  <th className="product_detail_th">{attributeGroup.name} :</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {attributeGroup.productAttributeValues.map((productAttribute) => (
                  <tr key={productAttribute.name}>
                    <th className="product_attribute_name_th">{productAttribute.name}</th>
                    <th className="product_attribute_value_th">{productAttribute.value}</th>
                  </tr>
                ))}
              </tbody>
            </Fragment>
          ))}
        </Table>
      </div>

      {/* Specification */}
      <Tabs defaultActiveKey="Specification" id="product-detail-tab" className="mb-3 " fill>
        <Tab eventKey="Specification" title="Specification" style={{ minHeight: '200px' }}>
          <div className="tabs" dangerouslySetInnerHTML={{ __html: product.specification }}></div>
        </Tab>
      </Tabs>

      {/* Related products */}
      <RelatedProduct productId={product.id} />
    </Container>
  );
};

export default ProductDetailsPage;
