import { default as axios } from 'axios';
import PixivAppApi from 'pixiv-app-api';
import { PixivIllustDetail } from 'pixiv-app-api/dist/PixivTypes';
import SaberAlter from './index';

export default class pixiv {
  private pixivApi: PixivAppApi;
  constructor() {
    this.pixivApi = new PixivAppApi(process.env.PIXIV_USERNAME, process.env.PIXIV_PASSWORD);
    this.login();
  }

  private login(): void {
    this.pixivApi
      .login()
      .then(() => {
        SaberAlter.log.info('Pixiv login successful');
        const newTimeout = this.pixivApi.authInfo().expiresIn * 1000 - 30000;
        setTimeout(this.login.bind(this), newTimeout);
      })
      .catch(SaberAlter.log.error);
  }

  public getImageDetail(id: number): Promise<PixivIllustDetail> {
    return this.pixivApi.illustDetail(id).then((imageMetadata) => {
      return imageMetadata;
    });
  }

  public getImage(imageMetadata: PixivIllustDetail): Promise<Buffer> {
    const image = imageMetadata.illust.imageUrls.large
      ? imageMetadata.illust.imageUrls.large
      : imageMetadata.illust.imageUrls.medium;
    return this.imageRequest(image);
  }

  public getAvatar(imageMetadata: PixivIllustDetail): Promise<Buffer> {
    return this.imageRequest(imageMetadata.illust.user.profileImageUrls.medium);
  }

  private imageRequest(url: string): Promise<Buffer> {
    return axios
      .get(url, {
        headers: {
          Referer: 'https://www.pixiv.net',
        },
        responseType: 'arraybuffer',
      })
      .then((response) => {
        return Buffer.from(response.data, 'binary');
      });
  }
}
