package br.com.corelabs.npsharpfx.backend.engine.editor;

import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.fxmisc.richtext.model.StyleSpans;
import org.fxmisc.richtext.model.StyleSpansBuilder;

public final class SyntaxHighlighter {

    private static final Map<String, Pattern> LANGUAGE_PATTERNS = new LinkedHashMap<>();
    private static final Collection<String> DEFAULT_STYLE = Collections.singleton("syntax-default");

    private static final String IDENT = "[A-Za-z_$][A-Za-z0-9_$]*";
    private static final String FUNCTION_CALL = "\\b" + IDENT + "(?=\\s*\\()";
    private static final String CONSTANT = "\\b([A-Z][A-Z0-9_]{2,}|true|false|null|undefined|None|nil|NULL)\\b";
    private static final String NUMBER = "(?<![\\w.])-?(?:0[xX][0-9A-Fa-f_]+|0[bB][01_]+|\\d[\\d_]*(?:\\.\\d[\\d_]*)?(?:[eE][+-]?\\d+)?)(?:[fFdDlLuU]|i8|i16|i32|i64|u8|u16|u32|u64|usize|isize)?\\b";
    private static final String STRING_DOUBLE = "\"(?:[^\"\\\\]|\\\\.)*\"";
    private static final String STRING_SINGLE = "'(?:[^'\\\\]|\\\\.)*'";
    private static final String STRING_TEMPLATE = "`(?:[^`\\\\]|\\\\.)*`";
    private static final String LINE_COMMENT = "//[^\\n]*";
    private static final String BLOCK_COMMENT = "/\\*[\\s\\S]*?\\*/";
    private static final String PUNCTUATION = "[{}\\[\\]();,.?:]";
    private static final String OPERATOR = "(==|!=|<=|>=|=>|->|<-|\\+\\+|--|&&|\\|\\||[+\\-*/%=&|!<>^~]+)";

    private static final Pattern BRAND_PATTERN = Pattern.compile(
            "(?<BRANDCORELABS>(?i:\\b\\w*corelabs\\w*\\b))"
                    + "|(?<BRANDGIRELLI>(?i:\\b\\w*girelli\\w*\\b))"
                    + "|(?<BRANDARCARI>(?i:\\b\\w*arcari\\w*\\b))"
    );

    private static final String[] BRAND_GROUPS = {
            "BRANDCORELABS", "BRANDGIRELLI", "BRANDARCARI"
    };

    private static final String[] TOKEN_GROUPS = {
            "COMMENT",
            "STRING",
            "ANNOTATION",
            "KEYWORD",
            "TYPE",
            "CONSTANT",
            "NUMBER",
            "FUNCTION",
            "VARIABLE",
            "PUNCTUATION",
            "OPERATOR",
            "INVALID"
    };

    static {
        Pattern javaLike = buildPattern(
                "COMMENT", BLOCK_COMMENT + "|" + LINE_COMMENT,
                "STRING", STRING_DOUBLE + "|" + STRING_SINGLE,
                "ANNOTATION", "@\\b" + IDENT + "\\b",
                "KEYWORD", words("abstract", "assert", "break", "case", "catch", "class", "const", "continue",
                        "default", "do", "else", "enum", "extends", "final", "finally", "for", "goto", "if",
                        "implements", "import", "instanceof", "interface", "native", "new", "non-sealed", "package",
                        "permits", "private", "protected", "public", "record", "return", "sealed", "static", "strictfp",
                        "super", "switch", "synchronized", "this", "throw", "throws", "transient", "try", "var",
                        "volatile", "while", "yield"),
                "TYPE", words("boolean", "byte", "char", "double", "float", "int", "long", "short", "void",
                        "String", "Object", "Integer", "Long", "Double", "Float", "Boolean", "Character", "List",
                        "Map", "Set", "ArrayList", "HashMap", "HashSet", "Optional", "Stream", "Collection",
                        "Exception", "RuntimeException", "Throwable"),
                "CONSTANT", CONSTANT,
                "NUMBER", NUMBER,
                "FUNCTION", FUNCTION_CALL,
                "PUNCTUATION", PUNCTUATION,
                "OPERATOR", OPERATOR
        );
        LANGUAGE_PATTERNS.put("Java", javaLike);

        LANGUAGE_PATTERNS.put("Kotlin", buildPattern(
                "COMMENT", BLOCK_COMMENT + "|" + LINE_COMMENT,
                "STRING", "\"\"\"[\\s\\S]*?\"\"\"|" + STRING_DOUBLE + "|" + STRING_TEMPLATE,
                "ANNOTATION", "@\\b" + IDENT + "\\b",
                "KEYWORD", words("as", "break", "by", "catch", "class", "companion", "constructor", "continue",
                        "data", "do", "else", "enum", "false", "finally", "for", "fun", "if", "import", "in",
                        "interface", "is", "it", "null", "object", "out", "override", "package", "private",
                        "protected", "public", "return", "sealed", "super", "this", "throw", "true", "try",
                        "typealias", "val", "var", "when", "where", "while"),
                "TYPE", words("Any", "Boolean", "Byte", "Char", "Double", "Float", "Int", "Long", "Nothing",
                        "Short", "String", "Unit", "List", "Map", "Set", "MutableList", "MutableMap"),
                "CONSTANT", CONSTANT,
                "NUMBER", NUMBER,
                "FUNCTION", FUNCTION_CALL,
                "PUNCTUATION", PUNCTUATION,
                "OPERATOR", OPERATOR
        ));

        Pattern jsLike = buildPattern(
                "COMMENT", BLOCK_COMMENT + "|" + LINE_COMMENT,
                "STRING", STRING_DOUBLE + "|" + STRING_SINGLE + "|" + STRING_TEMPLATE,
                "ANNOTATION", "@\\b" + IDENT + "\\b",
                "KEYWORD", words("as", "async", "await", "break", "case", "catch", "class", "const", "continue",
                        "debugger", "default", "delete", "do", "else", "enum", "export", "extends", "finally",
                        "for", "from", "function", "get", "if", "implements", "import", "in", "instanceof",
                        "interface", "let", "new", "of", "private", "protected", "public", "return", "set", "static",
                        "super", "switch", "this", "throw", "try", "type", "typeof", "var", "void", "while", "with",
                        "yield"),
                "TYPE", words("Array", "Boolean", "Date", "Error", "Function", "JSON", "Map", "Math", "Number",
                        "Object", "Promise", "Proxy", "RegExp", "Set", "String", "Symbol", "WeakMap", "WeakSet",
                        "any", "bigint", "boolean", "never", "number", "string", "unknown"),
                "CONSTANT", CONSTANT,
                "NUMBER", NUMBER,
                "FUNCTION", FUNCTION_CALL,
                "PUNCTUATION", PUNCTUATION,
                "OPERATOR", OPERATOR
        );
        LANGUAGE_PATTERNS.put("JavaScript", jsLike);
        LANGUAGE_PATTERNS.put("TypeScript", jsLike);

        LANGUAGE_PATTERNS.put("Python", buildPattern(
                "COMMENT", "#[^\\n]*",
                "STRING", "\"\"\"[\\s\\S]*?\"\"\"|'''[\\s\\S]*?'''|" + STRING_DOUBLE + "|" + STRING_SINGLE,
                "ANNOTATION", "@\\b" + IDENT + "\\b",
                "KEYWORD", words("False", "None", "True", "and", "as", "assert", "async", "await", "break",
                        "class", "continue", "def", "del", "elif", "else", "except", "finally", "for", "from",
                        "global", "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise",
                        "return", "try", "while", "with", "yield"),
                "TYPE", words("bool", "bytes", "dict", "float", "frozenset", "int", "list", "object", "range",
                        "set", "str", "tuple", "Exception", "self", "cls"),
                "CONSTANT", CONSTANT,
                "NUMBER", NUMBER,
                "FUNCTION", FUNCTION_CALL,
                "VARIABLE", "\\bself\\b|\\bcls\\b",
                "PUNCTUATION", PUNCTUATION,
                "OPERATOR", OPERATOR
        ));

        Pattern cLike = buildPattern(
                "COMMENT", BLOCK_COMMENT + "|" + LINE_COMMENT,
                "STRING", STRING_DOUBLE + "|" + STRING_SINGLE,
                "ANNOTATION", "#\\s*\\w+[^\\n]*",
                "KEYWORD", words("auto", "break", "case", "catch", "class", "const", "constexpr", "continue",
                        "default", "delete", "do", "else", "enum", "extern", "for", "friend", "goto", "if", "inline",
                        "namespace", "new", "operator", "override", "private", "protected", "public", "register",
                        "return", "sizeof", "static", "struct", "switch", "template", "this", "throw", "try",
                        "typedef", "typename", "union", "using", "virtual", "volatile", "while"),
                "TYPE", words("bool", "char", "double", "float", "int", "long", "short", "signed", "unsigned",
                        "void", "size_t", "int8_t", "int16_t", "int32_t", "int64_t", "uint8_t", "uint16_t",
                        "uint32_t", "uint64_t", "string", "vector", "map", "set", "list", "pair"),
                "CONSTANT", CONSTANT,
                "NUMBER", NUMBER,
                "FUNCTION", FUNCTION_CALL,
                "PUNCTUATION", PUNCTUATION,
                "OPERATOR", OPERATOR
        );
        LANGUAGE_PATTERNS.put("C", cLike);
        LANGUAGE_PATTERNS.put("C++", cLike);

        LANGUAGE_PATTERNS.put("C#", buildPattern(
                "COMMENT", BLOCK_COMMENT + "|" + LINE_COMMENT,
                "STRING", "@?\"(?:[^\"]|\"\")*\"|" + STRING_SINGLE,
                "ANNOTATION", "\\[[A-Za-z_][A-Za-z0-9_]*(?:\\([^\\]]*\\))?\\]",
                "KEYWORD", words("abstract", "as", "async", "await", "base", "break", "case", "catch", "checked",
                        "class", "const", "continue", "default", "delegate", "do", "else", "enum", "event", "explicit",
                        "extern", "finally", "fixed", "for", "foreach", "get", "if", "implicit", "in", "interface",
                        "internal", "is", "lock", "namespace", "new", "operator", "out", "override", "params",
                        "private", "protected", "public", "readonly", "record", "ref", "return", "sealed", "set",
                        "sizeof", "stackalloc", "static", "struct", "switch", "this", "throw", "try", "typeof",
                        "unchecked", "unsafe", "using", "virtual", "volatile", "while", "yield"),
                "TYPE", words("bool", "byte", "char", "decimal", "double", "float", "int", "long", "object", "sbyte",
                        "short", "string", "uint", "ulong", "ushort", "void", "var", "Task", "List", "Dictionary"),
                "CONSTANT", CONSTANT,
                "NUMBER", NUMBER,
                "FUNCTION", FUNCTION_CALL,
                "PUNCTUATION", PUNCTUATION,
                "OPERATOR", OPERATOR
        ));

        LANGUAGE_PATTERNS.put("PHP", buildPattern(
                "COMMENT", BLOCK_COMMENT + "|" + LINE_COMMENT + "|#[^\\n]*",
                "STRING", STRING_DOUBLE + "|" + STRING_SINGLE,
                "KEYWORD", words("abstract", "and", "array", "as", "break", "callable", "case", "catch", "class",
                        "clone", "const", "continue", "declare", "default", "die", "do", "echo", "else", "elseif",
                        "empty", "enddeclare", "endfor", "endforeach", "endif", "endswitch", "endwhile", "eval",
                        "exit", "extends", "final", "finally", "fn", "for", "foreach", "function", "global", "goto",
                        "if", "implements", "include", "instanceof", "interface", "isset", "list", "match", "namespace",
                        "new", "or", "print", "private", "protected", "public", "require", "return", "static",
                        "switch", "throw", "trait", "try", "use", "var", "while", "xor", "yield"),
                "TYPE", words("bool", "float", "int", "string", "array", "object", "mixed", "void", "never"),
                "VARIABLE", "\\$" + IDENT,
                "CONSTANT", CONSTANT,
                "NUMBER", NUMBER,
                "FUNCTION", FUNCTION_CALL,
                "PUNCTUATION", PUNCTUATION,
                "OPERATOR", OPERATOR
        ));

        LANGUAGE_PATTERNS.put("Go", buildPattern(
                "COMMENT", BLOCK_COMMENT + "|" + LINE_COMMENT,
                "STRING", STRING_DOUBLE + "|" + STRING_TEMPLATE,
                "KEYWORD", words("break", "case", "chan", "const", "continue", "default", "defer", "else",
                        "fallthrough", "for", "func", "go", "goto", "if", "import", "interface", "map", "package",
                        "range", "return", "select", "struct", "switch", "type", "var"),
                "TYPE", words("bool", "byte", "complex64", "complex128", "error", "float32", "float64", "int",
                        "int8", "int16", "int32", "int64", "rune", "string", "uint", "uint8", "uint16", "uint32",
                        "uint64", "uintptr"),
                "CONSTANT", "\\b(true|false|nil|iota)\\b",
                "NUMBER", NUMBER,
                "FUNCTION", FUNCTION_CALL,
                "PUNCTUATION", PUNCTUATION,
                "OPERATOR", OPERATOR
        ));

        LANGUAGE_PATTERNS.put("Rust", buildPattern(
                "COMMENT", BLOCK_COMMENT + "|" + LINE_COMMENT,
                "STRING", STRING_DOUBLE + "|" + STRING_SINGLE,
                "ANNOTATION", "#!?\\[[^\\]]*\\]",
                "KEYWORD", words("as", "async", "await", "break", "const", "continue", "crate", "dyn", "else",
                        "enum", "extern", "fn", "for", "if", "impl", "in", "let", "loop", "match", "mod", "move",
                        "mut", "pub", "ref", "return", "self", "Self", "static", "struct", "super", "trait", "type",
                        "unsafe", "use", "where", "while"),
                "TYPE", words("bool", "char", "f32", "f64", "i8", "i16", "i32", "i64", "i128", "isize", "str",
                        "u8", "u16", "u32", "u64", "u128", "usize", "String", "Vec", "Option", "Result", "Box"),
                "CONSTANT", "\\b(true|false|None|Some|Ok|Err)\\b",
                "NUMBER", NUMBER,
                "FUNCTION", FUNCTION_CALL,
                "PUNCTUATION", PUNCTUATION,
                "OPERATOR", OPERATOR
        ));

        LANGUAGE_PATTERNS.put("Lua", buildPattern(
                "COMMENT", "--\\[\\[[\\s\\S]*?\\]\\]|--[^\\n]*",
                "STRING", "\\[\\[[\\s\\S]*?\\]\\]|" + STRING_DOUBLE + "|" + STRING_SINGLE,
                "KEYWORD", words("and", "break", "do", "else", "elseif", "end", "false", "for", "function", "goto",
                        "if", "in", "local", "nil", "not", "or", "repeat", "return", "then", "true", "until", "while"),
                "CONSTANT", "\\b(true|false|nil)\\b",
                "NUMBER", NUMBER,
                "FUNCTION", FUNCTION_CALL,
                "PUNCTUATION", PUNCTUATION,
                "OPERATOR", OPERATOR
        ));

        LANGUAGE_PATTERNS.put("Portugol", buildPattern(
                "COMMENT", LINE_COMMENT,
                "STRING", STRING_DOUBLE,
                "KEYWORD", "(?i:\\b(algoritmo|var|inicio|fimalgoritmo|leia|escreva|escreval|se|entao|então|senao|senão|fimse|enquanto|faca|faça|fimenquanto|para|de|ate|até|passo|fimpara|repita|escolha|caso|fimescolha|procedimento|fimprocedimento|funcao|função|fimfuncao|fimfunção|retorne|e|ou|nao|não)\\b)",
                "TYPE", "(?i:\\b(inteiro|real|logico|lógico|caractere|literal|vetor)\\b)",
                "CONSTANT", "(?i:\\b(verdadeiro|falso)\\b)",
                "NUMBER", NUMBER,
                "FUNCTION", FUNCTION_CALL,
                "PUNCTUATION", PUNCTUATION,
                "OPERATOR", "(<-|>=|<=|<>|=|>|<|\\+|-|\\*|/|%)"
        ));

        LANGUAGE_PATTERNS.put("JSON", buildPattern(
                "STRING", "\"(?:[^\"\\\\]|\\\\.)*\"(?=\\s*:)|" + STRING_DOUBLE,
                "CONSTANT", "\\b(true|false|null)\\b",
                "NUMBER", NUMBER,
                "PUNCTUATION", "[{}\\[\\],:]"
        ));

        LANGUAGE_PATTERNS.put("HTML", buildPattern(
                "COMMENT", "<!--[\\s\\S]*?-->",
                "STRING", STRING_DOUBLE + "|" + STRING_SINGLE,
                "KEYWORD", "</?\\s*[A-Za-z][A-Za-z0-9:-]*|/?>",
                "VARIABLE", "\\b[A-Za-z_:][A-Za-z0-9_:.\\-]*(?=\\s*=)",
                "CONSTANT", "&[A-Za-z0-9#]+;",
                "PUNCTUATION", "[<>/=]"
        ));
        LANGUAGE_PATTERNS.put("XML", LANGUAGE_PATTERNS.get("HTML"));

        Pattern cssLike = buildPattern(
                "COMMENT", BLOCK_COMMENT,
                "STRING", STRING_DOUBLE + "|" + STRING_SINGLE,
                "ANNOTATION", "@[A-Za-z\\-]+",
                "KEYWORD", "[A-Za-z\\-]+(?=\\s*:)",
                "CONSTANT", "#[0-9A-Fa-f]{3,8}\\b|\\b(?:rgb|rgba|hsl|hsla|var|calc|min|max|clamp)(?=\\s*\\()",
                "NUMBER", "\\b\\d+(?:\\.\\d+)?(?:px|em|rem|%|vh|vw|vmin|vmax|pt|pc|deg|rad|turn|s|ms)?\\b",
                "FUNCTION", FUNCTION_CALL,
                "VARIABLE", "--[A-Za-z0-9\\-_]+",
                "PUNCTUATION", PUNCTUATION,
                "OPERATOR", OPERATOR
        );
        LANGUAGE_PATTERNS.put("CSS", cssLike);
        LANGUAGE_PATTERNS.put("SCSS", cssLike);

        LANGUAGE_PATTERNS.put("Markdown", buildPattern(
                "COMMENT", "<!--[\\s\\S]*?-->",
                "STRING", "`[^`]+`|```[\\s\\S]*?```",
                "KEYWORD", "(?m)^\\s{0,3}(#{1,6}|>|[-*+]\\s|\\d+\\.\\s)",
                "ANNOTATION", "\\[[^\\]]+\\]\\([^\\)]+\\)|!?\\[[^\\]]+\\]",
                "PUNCTUATION", "[*_~`>#\\-]"
        ));

        LANGUAGE_PATTERNS.put("YAML", buildPattern(
                "COMMENT", "#[^\\n]*",
                "STRING", STRING_DOUBLE + "|" + STRING_SINGLE,
                "KEYWORD", "(?m)^\\s*[A-Za-z0-9_.\\-]+(?=\\s*:)",
                "CONSTANT", "\\b(true|false|null|yes|no|on|off)\\b",
                "NUMBER", NUMBER,
                "PUNCTUATION", "[:\\[\\]{},\\-]"
        ));

        LANGUAGE_PATTERNS.put("TOML", buildPattern(
                "COMMENT", "#[^\\n]*",
                "STRING", STRING_DOUBLE + "|" + STRING_SINGLE,
                "ANNOTATION", "\\[[^\\]]+\\]",
                "KEYWORD", "(?m)^\\s*[A-Za-z0-9_.\\-]+(?=\\s*=)",
                "CONSTANT", "\\b(true|false)\\b",
                "NUMBER", NUMBER,
                "PUNCTUATION", "[=\\[\\]{},.]"
        ));

        LANGUAGE_PATTERNS.put("Properties", buildPattern(
                "COMMENT", "[#!][^\\n]*",
                "STRING", "(?<==).*",
                "KEYWORD", "(?m)^\\s*[^\\s:=#!]+(?=\\s*[:=])",
                "PUNCTUATION", "[:=]"
        ));

        LANGUAGE_PATTERNS.put("SQL", buildPattern(
                "COMMENT", BLOCK_COMMENT + "|--[^\\n]*",
                "STRING", STRING_SINGLE + "|" + STRING_DOUBLE,
                "KEYWORD", "(?i:\\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|DROP|ALTER|TABLE|INDEX|VIEW|JOIN|INNER|LEFT|RIGHT|OUTER|ON|AND|OR|NOT|IN|IS|NULL|LIKE|BETWEEN|EXISTS|HAVING|GROUP|BY|ORDER|ASC|DESC|LIMIT|OFFSET|UNION|ALL|AS|DISTINCT|COUNT|SUM|AVG|MIN|MAX|CASE|WHEN|THEN|ELSE|END|BEGIN|COMMIT|ROLLBACK|PRIMARY|KEY|FOREIGN|REFERENCES|UNIQUE)\\b)",
                "TYPE", "(?i:\\b(VARCHAR|INTEGER|TEXT|BOOLEAN|DATE|TIMESTAMP|FLOAT|DOUBLE|DECIMAL|NUMERIC|BIGINT|SMALLINT|SERIAL|UUID)\\b)",
                "NUMBER", NUMBER,
                "FUNCTION", FUNCTION_CALL,
                "PUNCTUATION", PUNCTUATION,
                "OPERATOR", OPERATOR
        ));

        LANGUAGE_PATTERNS.put("Shell Script", buildPattern(
                "COMMENT", "#[^\\n]*",
                "STRING", STRING_DOUBLE + "|" + STRING_SINGLE,
                "VARIABLE", "\\$\\{?" + IDENT + "\\}?",
                "KEYWORD", words("if", "then", "else", "elif", "fi", "for", "while", "do", "done", "case", "esac",
                        "in", "function", "return", "exit", "break", "continue", "local", "export", "readonly",
                        "declare", "source", "alias"),
                "NUMBER", NUMBER,
                "FUNCTION", FUNCTION_CALL,
                "PUNCTUATION", PUNCTUATION,
                "OPERATOR", OPERATOR
        ));

        LANGUAGE_PATTERNS.put("Batch", buildPattern(
                "COMMENT", "(?i:REM\\b[^\\n]*|::[^\\n]*)",
                "STRING", STRING_DOUBLE,
                "VARIABLE", "%[A-Za-z0-9_]+%|![A-Za-z0-9_]+!",
                "KEYWORD", "(?i:\\b(ECHO|SET|IF|ELSE|FOR|IN|DO|GOTO|CALL|EXIT|SHIFT|PAUSE|REM|CD|DIR|COPY|DEL|MOVE|MKDIR|RMDIR)\\b)",
                "NUMBER", NUMBER,
                "PUNCTUATION", PUNCTUATION,
                "OPERATOR", OPERATOR
        ));

        LANGUAGE_PATTERNS.put("PowerShell", buildPattern(
                "COMMENT", "<#[\\s\\S]*?#>|#[^\\n]*",
                "STRING", STRING_DOUBLE + "|" + STRING_SINGLE,
                "VARIABLE", "\\$[A-Za-z_][A-Za-z0-9_]*",
                "KEYWORD", "(?i:\\b(begin|break|catch|class|continue|data|do|dynamicparam|else|elseif|end|enum|exit|filter|finally|for|foreach|from|function|if|in|param|process|return|switch|throw|trap|try|until|using|var|while)\\b)",
                "TYPE", "\\[[A-Za-z0-9_.]+\\]",
                "NUMBER", NUMBER,
                "FUNCTION", "\\b[A-Za-z]+-[A-Za-z]+\\b",
                "PUNCTUATION", PUNCTUATION,
                "OPERATOR", OPERATOR
        ));
    }

    private SyntaxHighlighter() {
    }

    public static StyleSpans<Collection<String>> computeHighlighting(String text, String language) {
        if (text == null || text.isEmpty()) {
            return null;
        }

        Pattern langPattern = language == null ? null : LANGUAGE_PATTERNS.get(language);
        Pattern combined = langPattern == null
                ? BRAND_PATTERN
                : Pattern.compile(langPattern.pattern() + "|" + BRAND_PATTERN.pattern(), Pattern.MULTILINE);

        StyleSpansBuilder<Collection<String>> spansBuilder = new StyleSpansBuilder<>();
        Matcher matcher = combined.matcher(text);
        int lastEnd = 0;

        while (matcher.find()) {
            String styleClass = resolveStyleClass(matcher, langPattern != null);

            if (styleClass == null) {
                continue;
            }

            int plainLength = matcher.start() - lastEnd;
            if (plainLength > 0) {
                spansBuilder.add(DEFAULT_STYLE, plainLength);
            }

            spansBuilder.add(Collections.singleton(styleClass), matcher.end() - matcher.start());
            lastEnd = matcher.end();
        }

        int tailLength = text.length() - lastEnd;
        if (tailLength > 0) {
            spansBuilder.add(DEFAULT_STYLE, tailLength);
        }

        return spansBuilder.create();
    }

    public static boolean hasHighlighting(String language) {
        return language != null && LANGUAGE_PATTERNS.containsKey(language);
    }

    private static String resolveStyleClass(Matcher matcher, boolean hasLanguagePattern) {
        for (String group : BRAND_GROUPS) {
            if (hasGroup(matcher, group)) {
                return "syntax-" + group.toLowerCase().replace("brand", "brand-");
            }
        }

        if (!hasLanguagePattern) {
            return null;
        }

        for (String group : TOKEN_GROUPS) {
            if (hasGroup(matcher, group)) {
                return "syntax-" + group.toLowerCase();
            }
        }

        return null;
    }

    private static boolean hasGroup(Matcher matcher, String group) {
        try {
            return matcher.group(group) != null;
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }

    private static Pattern buildPattern(String... pairs) {
        StringBuilder sb = new StringBuilder();

        for (int i = 0; i < pairs.length; i += 2) {
            if (sb.length() > 0) {
                sb.append("|");
            }
            sb.append("(?<").append(pairs[i]).append(">").append(pairs[i + 1]).append(")");
        }

        return Pattern.compile(sb.toString(), Pattern.MULTILINE);
    }

    private static String words(String... values) {
        StringBuilder sb = new StringBuilder("\\b(?:");

        for (int i = 0; i < values.length; i++) {
            if (i > 0) {
                sb.append('|');
            }
            sb.append(Pattern.quote(values[i]));
        }

        sb.append(")\\b");
        return sb.toString();
    }
}
