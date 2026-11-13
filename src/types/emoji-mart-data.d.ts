/**
 * @emoji-mart/data 的类型声明。
 * tsconfig 未开启 resolveJsonModule，这里把 native.json 声明为具名模块，
 * 导入 JSON 时即可获得结构化的 EmojiMartData 类型。
 */
declare module '@emoji-mart/data/sets/15/native.json' {
  export interface EmojiMartSkin {
    unified: string;
    native: string;
    x?: number;
    y?: number;
  }

  export interface EmojiMartEmoji {
    id: string;
    name: string;
    keywords: string[];
    skin: number;
    version: number;
    skins: EmojiMartSkin[];
  }

  export interface EmojiMartCategory {
    id: string;
    emojis: string[];
  }

  export interface EmojiMartData {
    categories: EmojiMartCategory[];
    emojis: Record<string, EmojiMartEmoji>;
    aliases: Record<string, string>;
    sheet: { cols: number; rows: number };
  }

  const data: EmojiMartData;
  export default data;
}