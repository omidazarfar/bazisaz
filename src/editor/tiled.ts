import { EMPTY_TILE, type GameObject, type GameProject, type TileKind, type TilesVisual } from '../format/types';
import { makeObject, updateScene } from './state';

/**
 * Levels made in Tiled (mapeditor.org), the level editor most designers use, saved as JSON (.tmj or .json) (flagship
 * Phase E). Each tile layer becomes a tile map; each object of an object layer becomes a thing to place, with its
 * class (or type), name, box and custom properties. Tiles are told apart by their class or properties, so a game
 * can give them its own looks (an autotile set, a picture of its own) whatever the tileset's picture.
 */

export interface TiledProperty { name: string; type?: string; value: unknown }
interface TiledTile { id: number; type?: string; class?: string; properties?: TiledProperty[] }
interface TiledTileset { firstgid: number; name?: string; source?: string; tiles?: TiledTile[]; image?: string; columns?: number; tilewidth?: number; tileheight?: number; margin?: number; spacing?: number }
interface TiledObjectRaw { id: number; name?: string; type?: string; class?: string; x: number; y: number; width?: number; height?: number; gid?: number; point?: boolean; properties?: TiledProperty[]; visible?: boolean }
interface TiledLayerRaw {
  type: 'tilelayer' | 'objectgroup' | 'group' | 'imagelayer';
  name: string;
  width?: number;
  height?: number;
  data?: number[] | string;
  encoding?: 'csv' | 'base64';
  compression?: string;
  objects?: TiledObjectRaw[];
  layers?: TiledLayerRaw[];
  properties?: TiledProperty[];
  visible?: boolean;
  parallaxx?: number;
}
export interface TiledMapRaw { width: number; height: number; tilewidth: number; tileheight: number; infinite?: boolean; layers: TiledLayerRaw[]; tilesets: TiledTileset[]; properties?: TiledProperty[] }

/** What a tile is, as the level says: its tileset, its id there, its class and properties. */
export interface TiledTileInfo { gid: number; tileset: string; id: number; className: string; properties: Record<string, unknown> }
/** A thing placed in an object layer, in pixels (top-left corner), with its layer's name. */
export interface TiledThing { id: number; name: string; className: string; layer: string; x: number; y: number; width: number; height: number; properties: Record<string, unknown>; tile: TiledTileInfo | null }

export interface TiledLevel {
  /** The map's size in pixels and its cell size. */
  width: number;
  height: number;
  cell: number;
  /** One per tile layer, in order (the first is furthest back). */
  maps: { name: string; tiles: TilesVisual; properties: Record<string, unknown>; parallax: number }[];
  things: TiledThing[];
  properties: Record<string, unknown>;
  /** The tilesets, for cutting their pictures: where each tile is on its tileset's image. */
  tilesets: { name: string; firstgid: number; image: string | null; columns: number; tilewidth: number; tileheight: number; margin: number; spacing: number }[];
}

const props = (list?: TiledProperty[]): Record<string, unknown> => Object.fromEntries((list ?? []).map((p) => [p.name, p.value]));
/** Tiled keeps flips in a gid's top bits. */
const GID_MASK = 0x1fffffff;
/** Characters for kinds, never "." (an empty cell). */
const KEYS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+-=<>?@^~!';

function cells(layer: TiledLayerRaw): number[] {
  if (Array.isArray(layer.data)) return layer.data;
  if (typeof layer.data === 'string') {
    if (layer.compression) throw new Error(`Layer "${layer.name}" is compressed (${layer.compression}); save it in Tiled as CSV or uncompressed Base64.`);
    if (layer.encoding === 'csv') return layer.data.split(',').map((s) => Number(s.trim()));
    const bytes = Uint8Array.from(atob(layer.data.trim()), (c) => c.charCodeAt(0));
    const view = new DataView(bytes.buffer);
    return Array.from({ length: bytes.length / 4 }, (_, i) => view.getUint32(i * 4, true));
  }
  return [];
}

/**
 * Reads a Tiled map. `kindOf` gives each kind of tile its look and groups (a picture, an autotile set, tags);
 * without it, a tile becomes a grey block in a group named after its class.
 */
export function importTiled(text: string, kindOf?: (tile: TiledTileInfo) => Partial<TileKind> | null): TiledLevel {
  let map: TiledMapRaw;
  try {
    map = JSON.parse(text);
  } catch {
    throw new Error('This is not a Tiled map saved as JSON (.tmj).');
  }
  if (!map || !Array.isArray(map.layers) || !(map.tilewidth > 0)) throw new Error('This is not a Tiled map saved as JSON (.tmj).');
  if (map.infinite) throw new Error('Infinite maps are not read: in Tiled, untick "Infinite" in the map\'s properties.');
  const external = map.tilesets?.find((t) => t.source);
  if (external) throw new Error(`The tileset "${external.source}" is in a file of its own: in Tiled, embed it in the map (Map → Embed Tileset).`);
  const tilesets = [...(map.tilesets ?? [])].sort((a, b) => a.firstgid - b.firstgid);
  const tileInfo = (gid: number): TiledTileInfo => {
    const set = [...tilesets].reverse().find((t) => gid >= t.firstgid);
    const id = set ? gid - set.firstgid : gid;
    const tile = set?.tiles?.find((t) => t.id === id);
    return { gid, tileset: set?.name ?? '', id, className: tile?.class ?? tile?.type ?? '', properties: props(tile?.properties) };
  };
  const cell = map.tilewidth;
  const flat = (layers: TiledLayerRaw[]): TiledLayerRaw[] => layers.flatMap((l) => (l.type === 'group' ? flat(l.layers ?? []) : [l]));
  const layers = flat(map.layers).filter((l) => l.visible !== false);
  const maps: TiledLevel['maps'] = [];
  const things: TiledThing[] = [];
  for (const layer of layers) {
    if (layer.type === 'tilelayer') {
      const data = cells(layer);
      const w = layer.width ?? map.width;
      const keyOf = new Map<number, string>();
      const kinds: Record<string, TileKind> = {};
      const rows: string[] = [];
      for (let r = 0; r < (layer.height ?? map.height); r++) {
        let row = '';
        for (let c = 0; c < w; c++) {
          const gid = (data[r * w + c] ?? 0) & GID_MASK;
          if (!gid) {
            row += EMPTY_TILE;
            continue;
          }
          let key = keyOf.get(gid);
          if (!key) {
            const info = tileInfo(gid);
            const look = kindOf?.(info);
            if (look === null) {
              row += EMPTY_TILE;
              continue;
            }
            key = KEYS[keyOf.size] ?? '?';
            keyOf.set(gid, key);
            const name = info.className || `${info.tileset} ${info.id}`;
            const tags = typeof info.properties.tags === 'string' ? info.properties.tags.split(',').map((t) => t.trim()).filter(Boolean) : info.className ? [info.className] : [];
            kinds[key] = { name, color: '#8a96a3', tags, ...(info.properties.separate === true ? { separate: true } : {}), ...look };
          }
          row += key;
        }
        rows.push(row.replace(/\.+$/, ''));
      }
      maps.push({ name: layer.name, tiles: { kind: 'tiles', cell, rows, kinds }, properties: props(layer.properties), parallax: layer.parallaxx ?? 1 });
    } else if (layer.type === 'objectgroup') {
      for (const o of layer.objects ?? []) {
        if (o.visible === false) continue;
        const tile = o.gid ? tileInfo(o.gid & GID_MASK) : null;
        const [width, height] = [o.width ?? 0, o.height ?? 0];
        // A tile object stands on its bottom-left corner; other shapes hang from their top-left one.
        const y = o.gid ? o.y - height : o.y;
        things.push({
          id: o.id, name: o.name ?? '', className: o.class ?? o.type ?? tile?.className ?? '', layer: layer.name,
          x: o.x, y, width, height, properties: props(o.properties), tile,
        });
      }
    }
  }
  return {
    width: map.width * cell, height: map.height * map.tileheight, cell, maps, things, properties: props(map.properties),
    tilesets: tilesets.map((s) => ({ name: s.name ?? '', firstgid: s.firstgid, image: s.image ?? null, columns: s.columns ?? 0, tilewidth: s.tilewidth ?? cell, tileheight: s.tileheight ?? map.tileheight, margin: s.margin ?? 0, spacing: s.spacing ?? 0 })),
  };
}

/** Cuts tile `id` out of a tileset's picture. */
async function cutTile(src: string, set: TiledLevel['tilesets'][number], id: number): Promise<string> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const columns = set.columns || Math.max(1, Math.floor((img.naturalWidth - 2 * set.margin + set.spacing) / (set.tilewidth + set.spacing)));
  const [col, row] = [id % columns, Math.floor(id / columns)];
  const canvas = document.createElement('canvas');
  canvas.width = set.tilewidth;
  canvas.height = set.tileheight;
  canvas.getContext('2d')!.drawImage(img, set.margin + col * (set.tilewidth + set.spacing), set.margin + row * (set.tileheight + set.spacing), set.tilewidth, set.tileheight, 0, 0, set.tilewidth, set.tileheight);
  return canvas.toDataURL('image/png');
}

/**
 * A Tiled level put into a scene, as the editor's "+ مرحله از Tiled" does: the scene grows to the map's size; each
 * tile layer becomes a tile map (its tiles cut from the tileset's picture when it is given, among `images`, by file
 * name); each object becomes a box in a group named after its class (with the tile's picture, for a tile object),
 * for the user to give behaviors and rules. Returns the new project and what was made.
 */
export async function placeTiled(project: GameProject, sceneId: string, text: string, images: Map<string, string>) {
  const level = importTiled(text);
  const assets = { ...project.assets };
  const pictureOf = new Map<number, string>();
  const tilePicture = async (gid: number): Promise<string | undefined> => {
    if (pictureOf.has(gid)) return pictureOf.get(gid);
    const set = [...level.tilesets].reverse().find((s) => gid >= s.firstgid);
    const file = set?.image?.split(/[\/]/).pop();
    const src = file ? images.get(file) : undefined;
    if (!set || !src) return undefined;
    const key = `tiled-${set.name || 'tiles'}-${gid - set.firstgid}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    assets[key] = { type: 'image', src: await cutTile(src, set, gid - set.firstgid) };
    pictureOf.set(gid, key);
    return key;
  };
  // The kinds again, now with their pictures: each map's kind key stands for one gid (found by re-reading).
  const raw = JSON.parse(text) as TiledMapRaw;
  const objects: GameObject[] = [];
  for (const [i, m] of level.maps.entries()) {
    const layer = raw.layers.filter((l) => l.type === 'tilelayer' && l.visible !== false)[i];
    const data = layer ? cells(layer) : [];
    const width = layer?.width ?? raw.width;
    const kinds = { ...m.tiles.kinds };
    for (const [key] of Object.entries(kinds)) {
      const r = m.tiles.rows.findIndex((row) => row.includes(key));
      const c = r >= 0 ? m.tiles.rows[r].indexOf(key) : -1;
      const gid = r >= 0 ? (data[r * width + c] ?? 0) & GID_MASK : 0;
      const picture = gid ? await tilePicture(gid) : undefined;
      if (picture) kinds[key] = { ...kinds[key], asset: picture };
    }
    objects.push(makeObject(m.name || `نقشه ${i + 1}`, { ...m.tiles, kinds }, level.width, level.height, { x: level.width / 2, y: level.height / 2 }, { ...(m.parallax !== 1 ? { parallax: m.parallax } : {}) }));
  }
  for (const t of level.things) {
    const picture = t.tile ? await tilePicture(t.tile.gid) : undefined;
    const [w, h] = [Math.max(1, t.width || level.cell), Math.max(1, t.height || level.cell)];
    objects.push(makeObject(t.name || t.className || 'شیء', picture ? { kind: 'image', asset: picture } : { kind: 'rect', color: '#ffd23f' }, w, h, { x: t.x + w / 2, y: t.y + h / 2 }, { tags: t.className ? [t.className] : [] }));
  }
  const next = updateScene({ ...project, assets }, sceneId, (s) => ({ ...s, width: Math.max(s.width, level.width), height: Math.max(s.height, level.height), objects: [...s.objects, ...objects] }));
  return { project: next, maps: level.maps.length, things: level.things.length };
}
