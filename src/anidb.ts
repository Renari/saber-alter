import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import { default as axios, AxiosResponse } from 'axios';
import { Mutex } from 'async-mutex';
import xml2js from 'xml2js';
import SaberAlter from './index';

export interface AnimeResponse {
  anime: Anime;
}

export interface Anime {
  $: Purple;
  type: string[];
  episodecount: string[];
  startdate: Date[];
  enddate: Date[];
  titles: AnimeTitle[];
  relatedanime: Relatedanime[];
  url: string[];
  creators: Creator[];
  description: string[];
  ratings: AnimeRating[];
  picture: string[];
  resources: AnimeResource[];
  characters: AnimeCharacter[];
  episodes: AnimeEpisode[];
}

export interface Purple {
  id: string;
  restricted: string;
}

export interface AnimeCharacter {
  character: CharacterCharacter[];
}

export interface CharacterCharacter {
  $: Character;
  rating?: CharacterRating[];
  name: string[];
  gender: string[];
  charactertype: CharactertypeElement[];
  picture?: string[];
  seiyuu: SeiyuuElement[];
}

export interface Character {
  id: string;
  type: string;
  update: Date;
}

export interface CharactertypeElement {
  _: string;
  $: Charactertype;
}

export interface Charactertype {
  id: string;
}

export interface CharacterRating {
  _: string;
  $: Rating;
}

export interface Rating {
  votes: string;
}

export interface SeiyuuElement {
  _: string;
  $: Seiyuu;
}

export interface Seiyuu {
  id: string;
  picture: string;
}

export interface Creator {
  name: NameElement[];
}

export interface NameElement {
  _: string;
  $: Name;
}

export interface Name {
  id: string;
  type: string;
}

export interface AnimeEpisode {
  episode: EpisodeEpisode[];
}

export interface EpisodeEpisode {
  $: Episode;
  epno: EpnoElement[];
  length: string[];
  airdate: Date[];
  title: EpisodeTitle[];
}

export interface Episode {
  id: string;
  update: Date;
}

export interface EpnoElement {
  _: string;
  $: Epno;
}

export interface Epno {
  type: string;
}

export interface EpisodeTitle {
  _: string;
  $: Fluffy;
}

export interface Fluffy {
  'xml:lang': XMLLang;
}

export enum XMLLang {
  En = 'en',
  Ja = 'ja',
  XJat = 'x-jat',
}

export interface AnimeRating {
  permanent: PermanentElement[];
  temporary: PermanentElement[];
}

export interface PermanentElement {
  _: string;
  $: Permanent;
}

export interface Permanent {
  count: string;
}

export interface Relatedanime {
  anime: NameElement[];
}

export interface AnimeResource {
  resource: ResourceResource[];
}

export interface ResourceResource {
  $: Epno;
  externalentity: Externalentity[];
}

export interface Externalentity {
  identifier?: string[];
  url?: string[];
}

export interface AnimeTitle {
  title: TitleTitle[];
}

export interface TitleTitle {
  _: string;
  $: Tentacled;
}

export interface Tentacled {
  'xml:lang': XMLLang;
  type: string;
}

export default class anidb {
  private readonly baseUrl: string = util.format(
    'http://api.anidb.net:9001/httpapi?client=%s&clientver=%s&protover=1',
    process.env.ANIDB_CLIENT,
    process.env.ANIDB_CLIENT_VERSION,
  );
  private readonly cacheDir: string = path.resolve('anidbCache');
  private readonly mutex = new Mutex(); // used to prevent more than 1 request per 2 seconds

  private readonly writeFile = util.promisify(fs.writeFile);
  private readonly unlink = util.promisify(fs.unlink);
  private readonly readFile = util.promisify(fs.readFile);
  private readonly stat = util.promisify(fs.stat);
  private readonly xmlParser = new xml2js.Parser();

  constructor() {
    // create cache directory if it doesn't exist
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir);
    }
  }

  public getShowData(
    id: string,
    cacheFilePath: string = path.join(this.cacheDir, id),
  ): Promise<AnimeResponse> {
    // check if we have a cached response for this id
    if (fs.existsSync(cacheFilePath)) {
      // we have a cached file
      return this.stat(cacheFilePath).then((stat) => {
        if (new Date().getTime() - stat.birthtime.getTime() > 86400000) {
          // cached file is more than 24 hours old so delete it
          this.unlink(cacheFilePath).catch(); // ignore errors while trying to delete
          return this.requestShowData(cacheFilePath, id);
        } else {
          return this.getCacheFile(cacheFilePath, id);
        }
      });
    } else {
      // we do not have a cached copy of this request
      return this.requestShowData(cacheFilePath, id);
    }
  }

  private getCacheFile(cacheFilePath: string, id: string): Promise<AnimeResponse> {
    return this.readFile(cacheFilePath).then((buffer) => {
      SaberAlter.log.info('received show ' + id + ' from cache');
      return this.xmlParser.parseStringPromise(buffer.toString()).then((parsed) => {
        return parsed as AnimeResponse;
      });
    });
  }

  private async requestShowData(cacheFilePath: string, id: string): Promise<AnimeResponse> {
    const release = await this.mutex.acquire(); // wait till a request is possible
    // double check that this file still isn't in the cache (for duplicate links)
    if (fs.existsSync(cacheFilePath)) return this.getCacheFile(cacheFilePath, id);
    return axios
      .get(this.baseUrl + '&request=anime&aid=' + id)
      .then((response: AxiosResponse) => {
        // write our cache file for this show
        return this.writeFile(cacheFilePath, response.data).then(() => {
          SaberAlter.log.info('received show ' + id + ' from anidb');
          return this.xmlParser.parseStringPromise(response.data).then((parsed) => {
            if (parsed.error) throw parsed.error;
            return parsed as AnimeResponse;
          });
        });
      })
      .finally(() => {
        setTimeout(release, 4000); // wait 4 seconds to avoid being banned by anidb
      });
  }
}
