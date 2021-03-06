import {Token} from "./token";
import {ILexer} from "../lexer/lexer";
import {LexController} from "../lexer/lexcontroller";

/**
 * 字句解析器の状態を区別するためのラベル型
 */
export type LexStateLabel = string;

/**
 * デフォルトの字句解析器の状態
 */
export const DEFAULT_LEX_STATE = "default";

/**
 * 字句解析器に与える状態
 */
export interface LexState {
	label: LexStateLabel;
	inheritance?: LexStateLabel;
}

/**
 * 字句規則マッチ時に呼び出されるコールバック
 */
export type LexCallback = (value: string, token: string | null, lex: LexController) => [string | null, any] | { token: string | null, value: any } | string | null | void;

/**
 * 単一の字句ルール
 */
// TODO: tokenはlabelに名称変更してもよい？
export interface LexRule {
	token: Token | null;
	pattern: string | RegExp;
	states?: Array<LexStateLabel>;
	is_disabled?: boolean;
	priority?: number;
	callback?: LexCallback;
}

/**
 * 字句規則
 */
export interface LexDefinition {
	rules: Array<LexRule>;
	states?: Array<LexState>;
	start_state?: LexStateLabel;
	default_callback?: LexCallback;
	begin_callback?: (lex: LexController) => void;
	end_callback?: (lex: LexController) => void;
}

/**
 * 構文のreduce時に呼び出されるコールバック
 */
export type GrammarCallback = (children: Array<any>, token: string, lexer: ILexer) => any;

/**
 * 単一の構文ルール
 */
export interface GrammarRule {
	ltoken: Token;
	pattern: Array<Token>;
	callback?: GrammarCallback;
}

/**
 * 構文規則
 */
export interface GrammarDefinition {
	rules: Array<GrammarRule>;
	start_symbol: Token;
	default_callback?: GrammarCallback;
	// TODO: 存在はするが呼び出さないのを修正
	begin_callback?: () => void;
	end_callback?: () => void;
}

/**
 * 言語定義
 */
export interface Language {
	lex: LexDefinition;
	grammar: GrammarDefinition;
}
