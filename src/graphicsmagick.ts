import graphicsmagick from 'gm';
import SaberAlter from './index';

export async function scaleImageToSize(
  image: Buffer,
  filename: string,
  baseWidth: number,
  baseHeight: number,
  size: number,
): Promise<Buffer> {
  let width = baseWidth;
  let height = baseHeight;

  const isHorizontal = baseWidth > baseHeight;
  const maximumPixels = size / 4; // PNG is 4 bytes per pixel

  let area: number;

  do {
    if (isHorizontal) {
      width--; // horizontal image
      height = Math.floor((baseHeight / baseWidth) * width);
    } else {
      height--; // vertical image
      width = Math.floor((baseWidth / baseHeight) * height);
    }
    area = width * height;
  } while (area > maximumPixels);

  const gm = graphicsmagick(image, filename);

  return new Promise<Buffer>((resolve) => {
    gm.scale(width, height).toBuffer('PNG', (err, buffer) => {
      SaberAlter.log.debug(
        'Image scaled to ' +
          width +
          'x' +
          height +
          ' @ ' +
          (buffer.length / 1024 / 1024).toFixed(2) +
          'MB',
      );
      resolve(buffer);
    });
  });
}
