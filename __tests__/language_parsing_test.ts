import {language_language, language_parser} from "../src/precompiler/ruleparser";
import {ParserGenerator} from "../src/parsergenerator/parsergenerator";
import {language_language_without_callback} from "./data/language_language";

const input = require("fs").readFileSync("language", "utf8");

describe("language parsing test", () => {
	const pg = new ParserGenerator(language_language);
	console.error(pg.getTableType());
	test("valid parser", () => {
		expect(pg.isConflicted()).toBeFalsy();
	});
	const parser = pg.getParser(); // language_parserと同一のものであることが期待される
	test("parsing language file", () => {
		expect(parser.parse(input)).toEqual(language_language_without_callback);
	});
	// languageファイルを読み取ってパーサを生成したい
	test("language_parser", () => {
		expect(language_parser.parse(input)).toEqual(language_language_without_callback);
	});
});

// TODO: languageファイルにコールバックも記述可能にして、それを読み取れるようにする
