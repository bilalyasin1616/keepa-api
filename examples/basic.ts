import 'dotenv/config';
import KeepaClient, { isFoundProduct } from '../src/index.js';

async function main(): Promise<void> {
  const keepa = new KeepaClient({ apiKey: process.env.KEEPA_API_KEY });

  // A handful of popular Amazon products that should have rich Keepa data
  // (title, BSR, images). Listed in one call so we burn a single token batch.
  const asins = [
    'B0BDHWDR12', // Kindle Paperwhite (16 GB, 11th gen)
    'B09B8V1LZ3', // Fire TV Stick 4K Max
    'B08N5WRWNW', // Echo Dot (4th Gen)
    'B00MNV8E0C', // Amazon Basics AA batteries (kept as our previous control case)
  ];
  console.log(`Fetching ${asins.length} ASINs from Keepa US...\n`);

  const products = await keepa.products.list({ asins, marketplace: 'US' });
  const found = products.filter(isFoundProduct);

  console.log(`Total returned: ${products.length}, real (isFoundProduct): ${found.length}\n`);

  console.log(found);
  for (const product of found) {
    console.log(`\n— ${product.asin} —`);
    console.log({
      title: product.title?.slice(0, 60) + '…',
      bsr: product.bsr,
      imageCount: product.images.length,
      featureCount: product.features?.length ?? 0,
    });
    // if (product.images.length > 0) {
    //   console.log('images:');
    //   product.images.forEach((url, i) => console.log(`  [${i}] ${url}`));
    // }
    if (product.features && product.features.length > 0) {
      console.log('features:');
      product.features.forEach((f, i) =>
        console.log(`  [${i}] ${f.slice(0, 100)}${f.length > 100 ? '…' : ''}`),
      );
    }
  }
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
