const { Jimp } = require("jimp");
const fs = require('fs');

async function removeBlackBg(filename, outFilename) {
  try {
    const image = await Jimp.read(filename);
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
      const red = this.bitmap.data[idx + 0];
      const green = this.bitmap.data[idx + 1];
      const blue = this.bitmap.data[idx + 2];
      
      // If color is very dark (close to black)
      if (red < 25 && green < 25 && blue < 25) {
        this.bitmap.data[idx + 3] = 0; // set alpha to 0 (transparent)
      }
    });
    await image.write(outFilename);
    console.log(`Processed ${filename} -> ${outFilename}`);
  } catch (err) {
    console.error(`Error processing ${filename}:`, err);
  }
}

const ships = ['carrier', 'battleship', 'cruiser', 'submarine', 'destroyer'];

async function processAll() {
  for (const ship of ships) {
    const inPath = `public/ship_${ship}.png`;
    const outPath = `public/ship_${ship}_v2.png`;
    if (fs.existsSync(inPath)) {
      await removeBlackBg(inPath, outPath);
    } else {
      console.log(`Not found: ${inPath}`);
    }
  }
}

processAll();
