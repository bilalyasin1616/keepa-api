import 'dotenv/config';
import Keepa from '../src/index.js';

async function main(): Promise<void> {
  const keepa = new Keepa({ apiKey: process.env.KEEPA_API_KEY });

  // Stable test ASIN — Amazon Basics AA batteries.
  const asin = 'B00MNV8E0C';
  console.log(`Fetching ${asin} from Keepa US...\n`);

  const products = await keepa.products.list({
    asins: [asin],
    marketplace: 'US',
  });

  if (products.length === 0) {
    console.log('No product returned. Check your API key and token allowance.');
    return;
  }

  const product = products[0]!;
  console.log({
    asin: product.asin,
    title: product.title,
    parentAsin: product.parentAsin,
    rootCategory: product.rootCategory,
    bsr: product.bsr,
    firstImage: product.images[0] ?? null,
    imageCount: product.images.length,
    bulletPointsCount: product.bulletPoints?.length ?? 0,
  });
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
