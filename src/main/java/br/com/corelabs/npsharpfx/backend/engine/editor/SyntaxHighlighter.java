package br.com.corelabs.npsharpfx.backend.engine.editor;

import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.fxmisc.richtext.model.StyleSpans;
import org.fxmisc.richtext.model.StyleSpansBuilder;

/**
 * Motor de syntax highlighting baseado em regex.
 *
 * Suporta múltiplas linguagens com padrões de tokens
 * para keywords, strings, comments, numbers, types,
 * annotations, etc.
 *
 * Cada token é mapeado para uma classe CSS (ex: "syntax-keyword")
 * cujas cores são definidas via looked-up colors do tema.
 */
public class SyntaxHighlighter {

    // Grupos de tokens por linguagem (mapa cacheado)
    private static final Map<String, Pattern> LANGUAGE_PATTERNS = new LinkedHashMap<>();

    // === JAVA ===
    private static final String JAVA_KEYWORDS =
            "\\b(abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|"
                    + "default|do|double|else|enum|extends|final|finally|float|for|goto|if|implements|"
                    + "import|instanceof|int|interface|long|native|new|package|private|protected|public|"
                    + "return|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|"
                    + "try|void|volatile|while|var|yield|record|sealed|permits|non-sealed)\\b";

    private static final String JAVA_TYPES =
            "\\b(String|Integer|Long|Double|Float|Boolean|Character|Byte|Short|Object|"
                    + "List|Map|Set|ArrayList|HashMap|HashSet|Optional|Stream|"
                    + "Collection|Iterator|Iterable|Comparable|Runnable|Callable|"
                    + "Exception|RuntimeException|Error|Throwable|"
                    + "Override|Deprecated|SuppressWarnings|FunctionalInterface)\\b";

    private static final String JAVA_ANNOTATION = "@\\w+";
    private static final String JAVA_STRING = "\"([^\"\\\\]|\\\\.)*\"";
    private static final String JAVA_CHAR = "'([^'\\\\]|\\\\.)*'";
    private static final String JAVA_COMMENT_LINE = "//[^\n]*";
    private static final String JAVA_COMMENT_BLOCK = "/\\*[^*]*\\*+(?:[^/*][^*]*\\*+)*/";
    private static final String JAVA_NUMBER = "\\b\\d+(\\.\\d+)?[fFdDlL]?\\b";

    // === JAVASCRIPT / TYPESCRIPT ===
    private static final String JS_KEYWORDS =
            "\\b(async|await|break|case|catch|class|const|continue|debugger|default|delete|"
                    + "do|else|enum|export|extends|finally|for|from|function|if|implements|import|in|"
                    + "instanceof|interface|let|new|of|package|private|protected|public|return|static|"
                    + "super|switch|this|throw|try|typeof|var|void|while|with|yield)\\b";

    private static final String JS_TYPES =
            "\\b(Array|Boolean|Date|Error|Function|JSON|Map|Math|Number|Object|Promise|"
                    + "Proxy|RegExp|Set|String|Symbol|WeakMap|WeakSet|undefined|null|NaN|Infinity|"
                    + "true|false|any|never|unknown|string|number|boolean|void|bigint)\\b";

    private static final String JS_STRING_DOUBLE = "\"([^\"\\\\]|\\\\.)*\"";
    private static final String JS_STRING_SINGLE = "'([^'\\\\]|\\\\.)*'";
    private static final String JS_STRING_TEMPLATE = "`[^`]*`";
    private static final String JS_COMMENT_LINE = "//[^\n]*";
    private static final String JS_COMMENT_BLOCK = "/\\*[^*]*\\*+(?:[^/*][^*]*\\*+)*/";
    private static final String JS_NUMBER = "\\b\\d+(\\.\\d+)?\\b";

    // === PYTHON ===
    private static final String PY_KEYWORDS =
            "\\b(and|as|assert|async|await|break|class|continue|def|del|elif|else|except|"
                    + "finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|"
                    + "return|try|while|with|yield|True|False|None)\\b";

    private static final String PY_TYPES =
            "\\b(int|float|str|bool|list|dict|set|tuple|bytes|bytearray|complex|"
                    + "frozenset|memoryview|range|type|object|Exception|print|len|self)\\b";

    private static final String PY_DECORATOR = "@\\w+";
    private static final String PY_STRING_TRIPLE_D = "\"\"\"[\\s\\S]*?\"\"\"";
    private static final String PY_STRING_TRIPLE_S = "'''[\\s\\S]*?'''";
    private static final String PY_STRING_DOUBLE = "\"([^\"\\\\]|\\\\.)*\"";
    private static final String PY_STRING_SINGLE = "'([^'\\\\]|\\\\.)*'";
    private static final String PY_COMMENT = "#[^\n]*";
    private static final String PY_NUMBER = "\\b\\d+(\\.\\d+)?\\b";

    // === HTML ===
    private static final String HTML_TAG = "</?\\w[^>]*/?>";
    private static final String HTML_ATTR_VALUE = "\"[^\"]*\"|'[^']*'";
    private static final String HTML_COMMENT = "<!--[\\s\\S]*?-->";
    private static final String HTML_ENTITY = "&\\w+;";

    // === CSS ===
    private static final String CSS_PROPERTY = "[\\w-]+(?=\\s*:)";
    private static final String CSS_VALUE_NUMBER = "\\b\\d+(\\.\\d+)?(px|em|rem|%|vh|vw|pt|deg|s|ms)?\\b";
    private static final String CSS_COLOR = "#[0-9A-Fa-f]{3,8}\\b";
    private static final String CSS_STRING = "\"([^\"\\\\]|\\\\.)*\"|'([^'\\\\]|\\\\.)*'";
    private static final String CSS_COMMENT = "/\\*[^*]*\\*+(?:[^/*][^*]*\\*+)*/";
    private static final String CSS_AT_RULE = "@[\\w-]+";

    // === C / C++ ===
    private static final String C_KEYWORDS =
            "\\b(auto|break|case|char|const|continue|default|do|double|else|enum|extern|"
                    + "float|for|goto|if|inline|int|long|register|restrict|return|short|signed|sizeof|"
                    + "static|struct|switch|typedef|union|unsigned|void|volatile|while|"
                    + "class|namespace|template|typename|using|virtual|override|nullptr|"
                    + "bool|true|false|public|private|protected|new|delete|throw|try|catch)\\b";

    private static final String C_TYPES =
            "\\b(size_t|int8_t|int16_t|int32_t|int64_t|uint8_t|uint16_t|uint32_t|uint64_t|"
                    + "string|vector|map|set|list|pair|shared_ptr|unique_ptr|FILE|NULL)\\b";

    private static final String C_PREPROCESSOR = "#\\w+[^\n]*";
    private static final String C_STRING = "\"([^\"\\\\]|\\\\.)*\"";
    private static final String C_CHAR = "'([^'\\\\]|\\\\.)*'";
    private static final String C_COMMENT_LINE = "//[^\n]*";
    private static final String C_COMMENT_BLOCK = "/\\*[^*]*\\*+(?:[^/*][^*]*\\*+)*/";
    private static final String C_NUMBER = "\\b\\d+(\\.\\d+)?[fFlLuU]?\\b";

    // === GO ===
    private static final String GO_KEYWORDS =
            "\\b(break|case|chan|const|continue|default|defer|else|fallthrough|for|func|go|"
                    + "goto|if|import|interface|map|package|range|return|select|struct|switch|type|var)\\b";

    private static final String GO_TYPES =
            "\\b(bool|byte|complex64|complex128|error|float32|float64|int|int8|int16|int32|int64|"
                    + "rune|string|uint|uint8|uint16|uint32|uint64|uintptr|true|false|nil|iota)\\b";

    private static final String GO_STRING = "\"([^\"\\\\]|\\\\.)*\"|`[^`]*`";
    private static final String GO_COMMENT_LINE = "//[^\n]*";
    private static final String GO_COMMENT_BLOCK = "/\\*[^*]*\\*+(?:[^/*][^*]*\\*+)*/";
    private static final String GO_NUMBER = "\\b\\d+(\\.\\d+)?\\b";

    // === JSON ===
    private static final String JSON_KEY = "\"[^\"]+\"(?=\\s*:)";
    private static final String JSON_STRING = "\"([^\"\\\\]|\\\\.)*\"";
    private static final String JSON_NUMBER = "-?\\b\\d+(\\.\\d+)?([eE][+-]?\\d+)?\\b";
    private static final String JSON_BOOLEAN = "\\b(true|false|null)\\b";


private static final String PORTUGOL_PATTERN =

        "(?i)\\b(ALGORITMO|VAR|INICIO|FIMALGORITMO|"
                + "INTEIRO|REAL|LOGICO|CARACTERE|LITERAL|"
                + "LEIA|ESCREVA|ESCREVAL|"
                + "SE|ENTAO|SENAO|FIMSE|"
                + "ENQUANTO|FACA|FIMENQUANTO|"
                + "PARA|DE|ATE|PASSO|FIMPARA|"
                + "REPITA|"
                + "ESCOLHA|CASO|FIMESCOLHA|"
                + "PROCEDIMENTO|FIMPROCEDIMENTO|"
                + "FUNCAO|FIMFUNCAO|RETORNE|"
                + "E|OU|NAO|"
                + "VERDADEIRO|FALSO)\\b";

private static final String PORTUGOL_OPERATOR_PATTERN =

        "(<-|>=|<=|<>|=|>|<|\\+|-|\\*|/|%)";
private static final String PORTUGOL_BOOLEAN_PATTERN =


        "(?i)\\b(VERDADEIRO|FALSO)\\b";

    // === SQL ===
    private static final String SQL_KEYWORDS =
            "(?i)\\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|DROP|ALTER|"
                    + "TABLE|INDEX|VIEW|JOIN|INNER|LEFT|RIGHT|OUTER|ON|AND|OR|NOT|IN|IS|NULL|"
                    + "LIKE|BETWEEN|EXISTS|HAVING|GROUP|BY|ORDER|ASC|DESC|LIMIT|OFFSET|"
                    + "UNION|ALL|AS|DISTINCT|COUNT|SUM|AVG|MIN|MAX|CASE|WHEN|THEN|ELSE|END|"
                    + "BEGIN|COMMIT|ROLLBACK|CONSTRAINT|PRIMARY|KEY|FOREIGN|REFERENCES|UNIQUE|"
                    + "VARCHAR|INTEGER|TEXT|BOOLEAN|DATE|TIMESTAMP|FLOAT|DOUBLE|DECIMAL)\\b";

    private static final String SQL_STRING = "'([^'\\\\]|\\\\.)*'";
    private static final String SQL_COMMENT_LINE = "--[^\n]*";
    private static final String SQL_COMMENT_BLOCK = "/\\*[^*]*\\*+(?:[^/*][^*]*\\*+)*/";
    private static final String SQL_NUMBER = "\\b\\d+(\\.\\d+)?\\b";

    // === SHELL ===
    private static final String SHELL_KEYWORDS =
            "\\b(if|then|else|elif|fi|for|while|do|done|case|esac|in|function|"
                    + "return|exit|break|continue|local|export|readonly|declare|"
                    + "echo|cd|ls|grep|awk|sed|cat|rm|mv|cp|chmod|chown|"
                    + "source|alias|unalias)\\b";

    private static final String SHELL_VARIABLE = "\\$\\{?\\w+\\}?";
    private static final String SHELL_STRING_DOUBLE = "\"([^\"\\\\]|\\\\.)*\"";
    private static final String SHELL_STRING_SINGLE = "'[^']*'";
    private static final String SHELL_COMMENT = "#[^\n]*";
    private static final String SHELL_NUMBER = "\\b\\d+(\\.\\d+)?\\b";

    // === RUST ===
    private static final String RUST_KEYWORDS =
            "\\b(as|async|await|break|const|continue|crate|dyn|else|enum|extern|"
                    + "fn|for|if|impl|in|let|loop|match|mod|move|mut|pub|ref|return|"
                    + "self|Self|static|struct|super|trait|type|unsafe|use|where|while|yield)\\b";

    private static final String RUST_TYPES =
            "\\b(bool|char|f32|f64|i8|i16|i32|i64|i128|isize|str|u8|u16|u32|u64|u128|usize|"
                    + "String|Vec|Option|Result|Box|Rc|Arc|HashMap|BTreeMap|true|false|None|Some|Ok|Err)\\b";

    private static final String RUST_ATTRIBUTE = "#!?\\[\\w[^\\]]*\\]";
    private static final String RUST_STRING = "\"([^\"\\\\]|\\\\.)*\"";
    private static final String RUST_COMMENT_LINE = "//[^\n]*";
    private static final String RUST_COMMENT_BLOCK = "/\\*[^*]*\\*+(?:[^/*][^*]*\\*+)*/";
    private static final String RUST_NUMBER = "\\b\\d+(\\.\\d+)?(_\\d+)*[fiu]?(8|16|32|64|128|size)?\\b";

    // Compila os padrões por linguagem
    static {
        LANGUAGE_PATTERNS.put("Java", buildPattern(
                "COMMENT", JAVA_COMMENT_BLOCK + "|" + JAVA_COMMENT_LINE,
                "STRING", JAVA_STRING + "|" + JAVA_CHAR,
                "ANNOTATION", JAVA_ANNOTATION,
                "KEYWORD", JAVA_KEYWORDS,
                "TYPE", JAVA_TYPES,
                "NUMBER", JAVA_NUMBER
        ));

        LANGUAGE_PATTERNS.put("JavaScript", buildPattern(
                "COMMENT", JS_COMMENT_BLOCK + "|" + JS_COMMENT_LINE,
                "STRING", JS_STRING_DOUBLE + "|" + JS_STRING_SINGLE + "|" + JS_STRING_TEMPLATE,
                "KEYWORD", JS_KEYWORDS,
                "TYPE", JS_TYPES,
                "NUMBER", JS_NUMBER
        ));

        LANGUAGE_PATTERNS.put("TypeScript", LANGUAGE_PATTERNS.get("JavaScript"));

        LANGUAGE_PATTERNS.put("Python", buildPattern(
                "COMMENT", PY_COMMENT,
                "STRING", PY_STRING_TRIPLE_D + "|" + PY_STRING_TRIPLE_S + "|" + PY_STRING_DOUBLE + "|" + PY_STRING_SINGLE,
                "ANNOTATION", PY_DECORATOR,
                "KEYWORD", PY_KEYWORDS,
                "TYPE", PY_TYPES,
                "NUMBER", PY_NUMBER
        ));

        LANGUAGE_PATTERNS.put("HTML", buildPattern(
                "COMMENT", HTML_COMMENT,
                "STRING", HTML_ATTR_VALUE,
                "KEYWORD", HTML_TAG,
                "TYPE", HTML_ENTITY
        ));

        LANGUAGE_PATTERNS.put("CSS", buildPattern(
                "COMMENT", CSS_COMMENT,
                "STRING", CSS_STRING,
                "ANNOTATION", CSS_AT_RULE,
                "KEYWORD", CSS_PROPERTY,
                "NUMBER", CSS_VALUE_NUMBER + "|" + CSS_COLOR
        ));

        LANGUAGE_PATTERNS.put("C", buildPattern(
                "COMMENT", C_COMMENT_BLOCK + "|" + C_COMMENT_LINE,
                "STRING", C_STRING + "|" + C_CHAR,
                "ANNOTATION", C_PREPROCESSOR,
                "KEYWORD", C_KEYWORDS,
                "TYPE", C_TYPES,
                "NUMBER", C_NUMBER
        ));
        LANGUAGE_PATTERNS.put("C++", LANGUAGE_PATTERNS.get("C"));

        LANGUAGE_PATTERNS.put("C#", buildPattern(
                "COMMENT", C_COMMENT_BLOCK + "|" + C_COMMENT_LINE,
                "STRING", C_STRING,
                "KEYWORD", C_KEYWORDS,
                "TYPE", C_TYPES,
                "NUMBER", C_NUMBER
        ));

        LANGUAGE_PATTERNS.put("Go", buildPattern(
                "COMMENT", GO_COMMENT_BLOCK + "|" + GO_COMMENT_LINE,
                "STRING", GO_STRING,
                "KEYWORD", GO_KEYWORDS,
                "TYPE", GO_TYPES,
                "NUMBER", GO_NUMBER
        ));

        LANGUAGE_PATTERNS.put("JSON", buildPattern(
                "ANNOTATION", JSON_KEY,
                "STRING", JSON_STRING,
                "KEYWORD", JSON_BOOLEAN,
                "NUMBER", JSON_NUMBER
        ));

        LANGUAGE_PATTERNS.put("SQL", buildPattern(
                "COMMENT", SQL_COMMENT_BLOCK + "|" + SQL_COMMENT_LINE,
                "STRING", SQL_STRING,
                "KEYWORD", SQL_KEYWORDS,
                "NUMBER", SQL_NUMBER
        ));

        LANGUAGE_PATTERNS.put("Shell Script", buildPattern(
                "COMMENT", SHELL_COMMENT,
                "STRING", SHELL_STRING_DOUBLE + "|" + SHELL_STRING_SINGLE,
                "ANNOTATION", SHELL_VARIABLE,
                "KEYWORD", SHELL_KEYWORDS,
                "NUMBER", SHELL_NUMBER
        ));

        LANGUAGE_PATTERNS.put("Rust", buildPattern(
                "COMMENT", RUST_COMMENT_BLOCK + "|" + RUST_COMMENT_LINE,
                "STRING", RUST_STRING,
                "ANNOTATION", RUST_ATTRIBUTE,
                "KEYWORD", RUST_KEYWORDS,
                "TYPE", RUST_TYPES,
                "NUMBER", RUST_NUMBER
        ));

        LANGUAGE_PATTERNS.put("Kotlin", LANGUAGE_PATTERNS.get("Java"));
        LANGUAGE_PATTERNS.put("PHP", LANGUAGE_PATTERNS.get("JavaScript"));
        LANGUAGE_PATTERNS.put("SCSS", LANGUAGE_PATTERNS.get("CSS"));
    }

    // Token group names in order
    private static final Collection<String> DEFAULT_STYLE = Collections.singleton("syntax-default");

    private static final String[] TOKEN_GROUPS = {
            "COMMENT", "STRING", "ANNOTATION", "KEYWORD", "TYPE", "NUMBER"
    };

    // === EASTER EGG: Nomes especiais com cores únicas ===
    // corelabs / corelabsbr → laranja (syntax-brand-corelabs)
    // girelli / girellidev  → vermelho (syntax-brand-girelli)
    // arcari / arcaridev    → verde (syntax-brand-arcari)
    // RESERVADO: troque a cor rosa para o nome que quiser (syntax-brand-reserved)
    // private static final String BRAND_RESERVED = "(?<BRANDRESERVED>(?i)\\b(seunome|seunomedeve?)\\b)";
    private static final Pattern BRAND_PATTERN = Pattern.compile(
            "(?<BRANDCORELABS>(?i)\\b\\w*corelabs\\w*\\b)"
                    + "|(?<BRANDGIRELLI>(?i)\\b\\w*girelli\\w*\\b)"
                    + "|(?<BRANDARCARI>(?i)\\b\\w*arcari\\w*\\b)"
            // + "|(?<BRANDRESERVED>(?i)\\b\\w*SEUNOME\\w*\\b)"  // ← descomente e troque SEUNOME → cor rosa
    );

    private static final String[] BRAND_GROUPS = {
            "BRANDCORELABS", "BRANDGIRELLI", "BRANDARCARI"
            // , "BRANDRESERVED"  // ← descomente junto com o padrão acima
    };

    /**
     * Computa os StyleSpans de highlighting para o texto dado na linguagem especificada.
     * Retorna null se a linguagem não tem syntax highlighting.
     */
    public static StyleSpans<Collection<String>> computeHighlighting(String text, String language) {
        if (text == null || text.isEmpty()) {
            return null;
        }

        Pattern langPattern = (language != null) ? LANGUAGE_PATTERNS.get(language) : null;

        // Monta padrão combinado: linguagem + brands
        Pattern combined;

        if (langPattern != null) {
            combined = Pattern.compile(langPattern.pattern() + "|" + BRAND_PATTERN.pattern());
        } else {
            combined = BRAND_PATTERN;
        }

        StyleSpansBuilder<Collection<String>> spansBuilder = new StyleSpansBuilder<>();
        Matcher matcher = combined.matcher(text);
        int lastEnd = 0;

        while (matcher.find()) {
            String styleClass = null;

            // Checa brand groups primeiro (prioridade)
            for (String group : BRAND_GROUPS) {
                try {
                    if (matcher.group(group) != null) {
                        styleClass = "syntax-" + group.toLowerCase().replace("brand", "brand-");
                        break;
                    }
                } catch (IllegalArgumentException ignored) {}
            }

            // Se não é brand, checa tokens de linguagem
            if (styleClass == null && langPattern != null) {
                for (String group : TOKEN_GROUPS) {
                    try {
                        if (matcher.group(group) != null) {
                            styleClass = "syntax-" + group.toLowerCase();
                            break;
                        }
                    } catch (IllegalArgumentException ignored) {}
                }
            }

            if (styleClass != null) {
                spansBuilder.add(DEFAULT_STYLE, matcher.start() - lastEnd);
                spansBuilder.add(Collections.singleton(styleClass), matcher.end() - matcher.start());
                lastEnd = matcher.end();
            }
        }

        spansBuilder.add(DEFAULT_STYLE, text.length() - lastEnd);
        return spansBuilder.create();
    }

    /**
     * Verifica se uma linguagem tem syntax highlighting disponível.
     */
    public static boolean hasHighlighting(String language) {
        return language != null && LANGUAGE_PATTERNS.containsKey(language);
    }

    /**
     * Constrói um Pattern com named groups a partir de pares (nome, regex).
     */
    private static Pattern buildPattern(String... pairs) {
        StringBuilder sb = new StringBuilder();

        for (int i = 0; i < pairs.length; i += 2) {
            String name = pairs[i];
            String regex = pairs[i + 1];

            if (sb.length() > 0) {
                sb.append("|");
            }
            sb.append("(?<").append(name).append(">").append(regex).append(")");
        }

        return Pattern.compile(sb.toString());
    }
}
