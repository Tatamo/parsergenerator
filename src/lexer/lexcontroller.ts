import {DEFAULT_LEX_STATE, Language, LexDefinition, LexRule, LexState, LexStateLabel} from "../def/language";

export type LexRuleLabel = string;

class LexRuleManager {
	// private states: { states: Map<LexStateLabel, LexState>, index: Map<LexStateLabel, Set<number>>, inheritance: Map<LexStateLabel, LexStateLabel> };
	private states: Map<LexStateLabel, { state: LexState, index: Set<number> }>;
	private rules: { rules: Array<LexRule | undefined>, labels: Map<LexRuleLabel, number> };
	// 各ルールに一意なidを割り当てるためのカウンタ
	private id_counter: number;
	// ルールの削除によって割り当てがなくなったid
	private free_ids: Array<number>;
	constructor(language: Language) {
		const lex = language.lex;
		this.id_counter = 0;
		this.free_ids = [];

		// initialize lex states map
		this.states = new Map();
		// もしlexの定義内にデフォルト状態の記述があっても上書きされるだけなので問題ない
		this.setState({label: DEFAULT_LEX_STATE});
		if (lex.states !== undefined) {
			for (const state of lex.states) {
				this.setState(state);
			}
		}

		// initialize lex rules
		this.rules = {rules: [], labels: new Map()};

		for (const rule of lex.rules.map((r) => LexRuleManager.formatLexRule(r))) {
			this.rules.rules[this.id_counter] = rule;
			// 状態ごとにインデックスを張る
			for (const state of rule.state!) {
				// TODO: statesに入れる
				if (!this.states.has(state)) {
					this.setState(state);
				}
				this.states.get(state)!.index.add(this.id_counter);
			}
			this.id_counter += 1;
		}
	}
	setState(label: LexStateLabel): boolean;
	setState(state: LexState): boolean;
	setState(s: LexStateLabel | LexState): boolean {
		let state: LexState;
		if (typeof s === "object") {
			state = s;
		}
		else {
			state = {label: s};
		}
		state = LexRuleManager.formatLexState(state);
		// ループチェック
		const isLooped = (state: LexState): boolean => {
			if (state.inheritance !== undefined) {
				let flg_loop = false;
				let parent = this.states.get(state.inheritance);
				while (parent !== undefined && parent.state.inheritance !== undefined) {
					// 状態を追加するたびにチェックするので、自身にたどりつかないことを調べればよい
					if (parent.state.inheritance === state.label) {
						flg_loop = true;
						break;
					}
					parent = this.states.get(parent.state.inheritance);
				}
				if (flg_loop) return true;
			}
			return false;
		};
		// 循環継承が存在する場合は追加できない
		if (isLooped(state)) return false;
		if (this.states.has(state.label)) {
			// 既に追加済みの場合はindexをそのまま維持する
			this.states.get(state.label)!.state = state;
		}
		else {
			this.states.set(state.label, {state, index: new Set()});
		}
		return true;
	}
	// TODO: パフォーマンス改善
	getRulesItr(state: LexStateLabel): IterableIterator<LexRule> {
		// そんな状態はない
		if (!this.states.has(state)) return [][Symbol.iterator]();

		// 継承を加味
		let result: Array<number> = [];
		let s = this.states.get(state);
		while (s !== undefined) {
			result = result.concat([...s.index]);
			if (s.state.inheritance === undefined) break;
			s = this.states.get(s.state.inheritance);
		}
		// 暫定的処置
		result.sort((a: number, b: number) => a - b);

		return (function* (self, itr) {
			for (const id of itr) {
				if (self.rules.rules[id] !== undefined) yield self.rules.rules[id]!;
			}
		})(this, new Set(result)[Symbol.iterator]());
	}
	setRule(label: LexRuleLabel, rule: LexRule): void {
		// 同名の既存ルールを破棄
		this.removeRule(label);

		const formatted_rule = LexRuleManager.formatLexRule(rule);

		const id = this.free_ids.length > 0 ? this.free_ids.pop()! : this.id_counter++;
		this.rules.rules[id] = formatted_rule;
		this.rules.labels.set(label, id);
		for (const state of formatted_rule.state!) {
			if (!this.states.has(state)) this.setState(state);
			this.states.get(state)!.index.add(id);
		}
	}
	removeRule(label: LexRuleLabel): LexRule | null {
		if (!this.rules.labels.has(label)) {
			return null;
		}
		const id = this.rules.labels.get(label)!;
		const rule = this.rules.rules[id];
		if (rule === undefined) return null;

		for (const state of rule.state!) {
			if (this.states.has(state)) {
				this.states.get(state)!.index.delete(id);
			}
		}
		this.rules.rules[id] = undefined;
		this.free_ids.push(id);
		return rule;
	}
	static formatLexState(state: LexState): LexState {
		// clone state
		return {...state};
	}
	static formatLexRule(rule: LexRule): LexRule {
		// clone rule
		const result = {...rule};
		if (result.is_disabled === undefined) result.is_disabled = false;
		// 状態指定を省略された場合はデフォルト状態のみとする
		if (result.state === undefined) result.state = [DEFAULT_LEX_STATE];
		// 正規表現を字句解析に適した形に整形
		if (result.pattern instanceof RegExp) {
			result.pattern = LexRuleManager.formatRegExp(result.pattern);
		}
		return result;
	}
	private static formatRegExp(pattern: RegExp): RegExp {
		// フラグを整形する
		let flags: string = "";
		// gフラグは邪魔なので取り除く
		// i,m,uフラグがあれば維持する
		if (pattern.ignoreCase) {
			flags += "i";
		}
		if (pattern.multiline) {
			flags += "m";
		}
		if (pattern.unicode) {
			flags += "u";
		}
		// yフラグは必ずつける
		flags += "y";
		return new RegExp(pattern, flags);
	}
}

export class LexController {
	private _lex: LexDefinition;
	private _current_state: LexStateLabel;
	private _state_stack: Array<LexStateLabel>;
	private _rules: LexRuleManager;
	constructor(language: Language) {
		this._lex = language.lex;
		this._current_state = DEFAULT_LEX_STATE;
		this._state_stack = [];
		this._rules = new LexRuleManager(language);
	}
	onBegin(): void {
		if (this._lex.begin_callback !== undefined) this._lex.begin_callback(this);
	}
	onEnd(): void {
		if (this._lex.end_callback !== undefined) this._lex.end_callback(this);
	}
	getRulesItr(): IterableIterator<LexRule> {
		return this._rules.getRulesItr(this._current_state);
	}
	addRule(label: string, rule: LexRule): void {
		this._rules.setRule(label, rule);
	}
	removeRule(label: string): LexRule | null {
		return this._rules.removeRule(label);
	}
	getCurrentState(): LexStateLabel {
		return this._current_state;
	}
	jumpState(state: LexStateLabel): void {
		this._current_state = state;
	}
	callState(state: LexStateLabel): void {
		this._state_stack.push(this._current_state);
		this._current_state = state;
	}
	returnState(): LexStateLabel | undefined {
		const pop = this._state_stack.pop();
		if (pop === undefined) this._current_state = DEFAULT_LEX_STATE;
		else this._current_state = pop;
		return pop;
	}
}